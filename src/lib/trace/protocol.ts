/** The message contract between the UI thread and the tracing worker. */

import type {
	AnyParams,
	EngineId,
	Phase,
	PresetName,
	RenderTarget,
	TraceOutput,
	TraceParams
} from '$lib/engines/types';

export type Request =
	| { type: 'defaults'; id: number; preset: PresetName }
	/** Hand the worker an image. The bitmap is transferred, not copied. */
	| { type: 'load'; id: number; bitmap: ImageBitmap; previewMaxEdge: number }
	| {
			type: 'render';
			id: number;
			engine: EngineId;
			params: AnyParams;
			target: RenderTarget;
			svgo: boolean;
	  };

export type Response =
	| { type: 'ready'; version: string }
	| { type: 'defaults'; id: number; params: TraceParams }
	| { type: 'loaded'; id: number; width: number; height: number; previewScale: number }
	| { type: 'progress'; id: number; phase: Phase; fraction: number }
	| {
			type: 'result';
			id: number;
			target: RenderTarget;
			ms: number;
			output: TraceOutput;
			/** Present when SVGO ran: bytes before and after. */
			optimized?: { beforeBytes: number; afterBytes: number };
	  }
	| { type: 'error'; id: number; message: string };

/** Responses that conclude a request. Anything else is an intermediate update. */
export function isTerminal(m: Response): boolean {
	return m.type !== 'progress' && m.type !== 'ready';
}
