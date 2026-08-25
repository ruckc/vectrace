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
import { optimizeSvg } from '$lib/svg/optimize';
import type { PresetName, RenderTarget, TraceOutput, TraceParams } from '$lib/engines/types';
import type { Request, Response } from './protocol';

const post = (m: Response) => self.postMessage(m);

/** One entry per resolution: the vtracer session, plus the pixels potrace needs. */
interface Loaded {
	session: TraceSession;
	image: ImageData;
}

let full: Loaded | null = null;
let preview: Loaded | null = null;

const ready = init({ module_or_path: wasmUrl }).then(() => {
	post({ type: 'ready', version: '1.0.0-alpha.3' });
});

/** Draw a bitmap to a canvas at `scale` and read back its RGBA bytes. */
function toImageData(bitmap: ImageBitmap, scale: number): ImageData {
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('could not get a 2d context in the worker');
	ctx.drawImage(bitmap, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height);
}

function load(bitmap: ImageBitmap, scale: number): Loaded {
	const image = toImageData(bitmap, scale);
	return {
		image,
		session: new TraceSession(image.width, image.height, new Uint8Array(image.data.buffer))
	};
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
				width: full.image.width,
				height: full.image.height,
				previewScale
			};
		}

		case 'render': {
			const loaded = pick(req.target);
			const started = performance.now();

			if (req.engine === 'potrace') {
				const output = await potraceTrace(loaded.image, req.params);
				return finish(req.id, req.target, started, output, req.svgo);
			}

			const output = loaded.session.renderWithProgress(
				req.params,
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
