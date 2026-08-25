/**
 * Main-thread wrapper around the tracing worker.
 *
 * The worker blocks while wasm runs, so the scheduling rule is: at most one render in
 * flight, and only ever one queued behind it. A newer request replaces the queued one
 * rather than joining a backlog — by the time the current render lands, intermediate
 * slider positions are of no interest to anyone.
 */

import type {
	AnyParams,
	EngineId,
	Phase,
	PresetName,
	RenderTarget,
	TraceOutput,
	TraceParams
} from '$lib/engines/types';
import type { Request, Response } from './protocol';

/** Longest edge of the downscaled copy used for live previews. */
export const PREVIEW_MAX_EDGE = 800;

export interface RenderResult extends TraceOutput {
	target: RenderTarget;
	ms: number;
	/** Present when SVGO ran. */
	optimized?: { beforeBytes: number; afterBytes: number };
}

export interface LoadResult {
	width: number;
	height: number;
	/** 1 when previews trace the full-resolution image. */
	previewScale: number;
}

type Pending = {
	resolve: (v: never) => void;
	reject: (e: Error) => void;
	onProgress?: (phase: Phase, fraction: number) => void;
};

export class TraceClient {
	#worker: Worker;
	#pending = new Map<number, Pending>();
	#nextId = 1;

	/** The render waiting for the in-flight one to finish, if any. */
	#queued: {
		engine: EngineId;
		params: AnyParams;
		target: RenderTarget;
		svgo: boolean;
	} | null = null;
	#inFlight = false;

	/** Called for every render completed via {@link schedule}. */
	onResult?: (r: RenderResult) => void;
	/** Called when a render completed via {@link schedule} fails. */
	onError?: (e: Error) => void;

	constructor() {
		this.#worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		this.#worker.onmessage = (e: MessageEvent<Response>) => this.#receive(e.data);
		this.#worker.onerror = (e) => this.#failAll(new Error(e.message || 'worker crashed'));
	}

	#receive(m: Response) {
		if (m.type === 'ready') return;

		const pending = this.#pending.get(m.id);
		if (!pending) return;

		if (m.type === 'progress') {
			pending.onProgress?.(m.phase, m.fraction);
			return;
		}

		this.#pending.delete(m.id);
		if (m.type === 'error') pending.reject(new Error(m.message));
		else if (m.type === 'result')
			pending.resolve({
				...m.output,
				target: m.target,
				ms: m.ms,
				optimized: m.optimized
			} as never);
		else if (m.type === 'loaded')
			pending.resolve({ width: m.width, height: m.height, previewScale: m.previewScale } as never);
		else if (m.type === 'defaults') pending.resolve(m.params as never);
	}

	#failAll(err: Error) {
		for (const p of this.#pending.values()) p.reject(err);
		this.#pending.clear();
		this.#inFlight = false;
		this.#queued = null;
	}

	#send<T>(
		req: Request,
		transfer?: Transferable[],
		onProgress?: Pending['onProgress']
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.#pending.set(req.id, { resolve: resolve as never, reject, onProgress });
			this.#worker.postMessage(req, transfer ?? []);
		});
	}

	/** vtracer's own defaults for a preset. */
	defaults(preset: PresetName = 'default'): Promise<TraceParams> {
		return this.#send({ type: 'defaults', id: this.#nextId++, preset });
	}

	/** Hand an image to the worker. The bitmap is transferred and must not be reused. */
	load(bitmap: ImageBitmap, previewMaxEdge = PREVIEW_MAX_EDGE): Promise<LoadResult> {
		return this.#send({ type: 'load', id: this.#nextId++, bitmap, previewMaxEdge }, [bitmap]);
	}

	/**
	 * Trace once. Callers who need every result should await this; the tuning UI should
	 * use {@link schedule} instead.
	 */
	render(
		engine: EngineId,
		params: AnyParams,
		target: RenderTarget = 'full',
		svgo = false,
		onProgress?: (phase: Phase, fraction: number) => void
	): Promise<RenderResult> {
		return this.#send(
			{ type: 'render', id: this.#nextId++, engine, params, target, svgo },
			undefined,
			onProgress
		);
	}

	/**
	 * Latest-wins render for interactive tuning: fire and forget, results arrive on
	 * {@link onResult}.
	 *
	 * Calling this while a render is running replaces whatever was queued, so dragging a
	 * slider produces one render per completed render rather than one per input event.
	 */
	schedule(engine: EngineId, params: AnyParams, target: RenderTarget = 'preview', svgo = false) {
		this.#queued = { engine, params, target, svgo };
		if (!this.#inFlight) void this.#drain();
	}

	async #drain() {
		this.#inFlight = true;
		try {
			while (this.#queued) {
				const { engine, params, target, svgo } = this.#queued;
				this.#queued = null;
				try {
					this.onResult?.(await this.render(engine, params, target, svgo));
				} catch (err) {
					this.onError?.(err instanceof Error ? err : new Error(String(err)));
				}
			}
		} finally {
			this.#inFlight = false;
		}
	}

	/** True while a scheduled render is running or queued. */
	get busy() {
		return this.#inFlight;
	}

	terminate() {
		this.#worker.terminate();
		this.#failAll(new Error('worker terminated'));
	}
}
