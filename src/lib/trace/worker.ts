/**
 * The tracing worker: owns the engines and the loaded image.
 *
 * The vtracer sessions are long-lived on purpose. vtracer caches its segmentation inside
 * the session and only re-clusters when a clustering-relevant parameter changes, so
 * repeated renders while the user drags a slider are cheap. potrace has no equivalent, so
 * it keeps the raw `ImageData` around and re-traces from scratch each time.
 *
 * Note there is no cancellation here. GitHub Pages cannot send COOP/COEP headers, so
 * `SharedArrayBuffer` is unavailable and a worker blocked inside wasm cannot observe an
 * incoming message. The UI keeps at most one render in flight instead; see `client.ts`.
 */

import init, { TraceSession, defaultConfig } from '$lib/wasm/vectrace.js';
import wasmUrl from '$lib/wasm/vectrace_bg.wasm?url';
import { trace as potraceTrace } from '$lib/engines/potrace';
import { binarize, type BinarizeMode } from '$lib/image/binarize';
import { optimizeSvg } from '$lib/svg/optimize';
import type { PresetName, RenderTarget, TraceOutput, TraceParams } from '$lib/engines/types';
import type { Request, Response } from './protocol';

const post = (m: Response) => self.postMessage(m);

/**
 * One entry per resolution.
 *
 * `source` is the decoded image; `image` is what the engines actually see, which differs
 * once preprocessing is on. The vtracer session is built from `image`, so it has to be
 * rebuilt whenever the preprocessing settings change — `key` records what it was built
 * from so unrelated parameter changes still hit the cache.
 */
interface Loaded {
	source: ImageData;
	image: ImageData;
	session: TraceSession;
	key: string;
}

let full: Loaded | null = null;
let preview: Loaded | null = null;

const ready = init({ module_or_path: wasmUrl }).then(() => {
	post({ type: 'ready', version: '1.0.0-alpha.3' });
});

/**
 * Draw a bitmap to a canvas at `scale` and read back its RGBA bytes.
 *
 * Alpha is preserved rather than flattened here, because it is genuine signal: for a
 * cut-out logo it says exactly what the mark is, and `binarize` uses it. Flattening
 * happens later, and only where it is safe — see `matte`.
 */
function toImageData(bitmap: ImageBitmap, scale: number): ImageData {
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('could not get a 2d context in the worker');
	ctx.drawImage(bitmap, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height);
}

/**
 * Composite over white for engines that read RGB and ignore alpha.
 *
 * Without this, the transparent background of a cut-out logo reaches the engine as solid
 * black — a fresh canvas is transparent *black* — and gets traced as the subject. Returns
 * the input untouched when the image is already fully opaque.
 */
function matte(image: ImageData): ImageData {
	const src = image.data;
	let hasAlpha = false;
	for (let i = 3; i < src.length; i += 4) {
		if (src[i] < 255) {
			hasAlpha = true;
			break;
		}
	}
	if (!hasAlpha) return image;

	const out = new Uint8ClampedArray(src.length);
	for (let i = 0; i < src.length; i += 4) {
		const a = src[i + 3] / 255;
		out[i] = Math.round(src[i] * a + 255 * (1 - a));
		out[i + 1] = Math.round(src[i + 1] * a + 255 * (1 - a));
		out[i + 2] = Math.round(src[i + 2] * a + 255 * (1 - a));
		out[i + 3] = 255;
	}
	return new ImageData(out as ImageDataArray, image.width, image.height);
}

function session(image: ImageData): TraceSession {
	return new TraceSession(image.width, image.height, new Uint8Array(image.data.buffer));
}

function load(bitmap: ImageBitmap, scale: number): Loaded {
	const source = toImageData(bitmap, scale);
	const image = matte(source);
	return { source, image, session: session(image), key: 'off|false' };
}

/** Bring a slot's session in line with the requested preprocessing, reusing it if possible. */
function prepared(slot: Loaded, mode: BinarizeMode, invert: boolean): Loaded {
	const key = `${mode}|${invert}`;
	if (slot.key === key) return slot;

	// `binarize` reads alpha itself and decides what the mark is, so it gets the original.
	// Everything else needs the transparency flattened first.
	const image =
		mode === 'off'
			? matte(slot.source)
			: new ImageData(
					// The DOM types insist on a plain ArrayBuffer here; binarize allocates one.
					binarize(slot.source.data, mode, invert).data as ImageDataArray,
					slot.source.width,
					slot.source.height
				);

	slot.session.free();
	slot.image = image;
	slot.session = session(image);
	slot.key = key;
	return slot;
}

function pick(target: RenderTarget): Loaded {
	const chosen = target === 'preview' ? (preview ?? full) : full;
	if (!chosen) throw new Error('no image loaded');
	return chosen;
}

/** Wrap up a finished trace, running SVGO first if it was asked for. */
function finish(
	id: number,
	target: RenderTarget,
	started: number,
	output: TraceOutput,
	svgo: boolean
): Response {
	// SVGO runs here rather than on the UI thread: it is the second-most expensive step
	// and there is no reason to block painting for it.
	const optimized = svgo ? optimizeSvg(output.svg) : null;

	return {
		type: 'result',
		id,
		target,
		ms: performance.now() - started,
		output: optimized ? { ...output, svg: optimized.svg } : output,
		optimized: optimized
			? { beforeBytes: optimized.beforeBytes, afterBytes: optimized.afterBytes }
			: undefined
	};
}

async function handle(req: Request): Promise<Response> {
	switch (req.type) {
		case 'defaults': {
			const preset: PresetName = req.preset;
			return {
				type: 'defaults',
				id: req.id,
				params: defaultConfig(preset) as TraceParams
			};
		}

		case 'load': {
			full?.session.free();
			preview?.session.free();
			preview = null;

			const { bitmap, previewMaxEdge } = req;
			full = load(bitmap, 1);

			// Only build a downscaled copy when the image is actually big enough to
			// benefit; otherwise previews just reuse the full-resolution one.
			const longEdge = Math.max(bitmap.width, bitmap.height);
			const previewScale = longEdge > previewMaxEdge ? previewMaxEdge / longEdge : 1;
			if (previewScale < 1) preview = load(bitmap, previewScale);

			bitmap.close();
			return {
				type: 'loaded',
				id: req.id,
				width: full.source.width,
				height: full.source.height,
				previewScale
			};
		}

		case 'render': {
			const started = performance.now();

			// Preprocessing keys are carried alongside the engine's own parameters; strip
			// them out so neither engine sees a setting it does not understand.
			const {
				binarize: mode,
				invert,
				...engineParams
			} = req.params as {
				binarize?: BinarizeMode;
				invert?: boolean;
			} & Record<string, unknown>;
			const loaded = prepared(pick(req.target), mode ?? 'off', Boolean(invert));

			if (req.engine === 'potrace') {
				const output = await potraceTrace(loaded.image, engineParams);
				return finish(req.id, req.target, started, output, req.svgo);
			}

			const output = loaded.session.renderWithProgress(
				engineParams,
				(phase: string, fraction: number) => {
					post({ type: 'progress', id: req.id, phase: phase as never, fraction });
					return false;
				}
			) as TraceOutput;
			return finish(req.id, req.target, started, output, req.svgo);
		}
	}
}

self.onmessage = async (e: MessageEvent<Request>) => {
	await ready;
	try {
		post(await handle(e.data));
	} catch (err) {
		post({
			type: 'error',
			id: e.data.id,
			message: err instanceof Error ? err.message : String(err)
		});
	}
};
