/**
 * The engine-agnostic tracing contract.
 *
 * Only vtracer implements this today. It exists now so that adding potrace later is a
 * matter of writing a second implementation rather than reshaping the worker.
 */

/** Which tracing backend produces the SVG. */
export type EngineId = 'vtracer' | 'potrace';

export interface EngineInfo {
	id: EngineId;
	label: string;
	blurb: string;
	license: string;
}

export const ENGINES: EngineInfo[] = [
	{
		id: 'vtracer',
		label: 'VTracer',
		blurb: 'Colour vectorization. The default, and the right choice for most images.',
		license: 'MIT'
	},
	{
		id: 'potrace',
		label: 'Potrace',
		blurb: 'The classic bitmap tracer. Often smoother on black-and-white line art.',
		license: 'GPL-2.0-or-later'
	}
];

export type Clustering = 'color' | 'binary' | 'watershed';
export type Hierarchical = 'stacked' | 'cutout';
export type FitMode = 'pixel' | 'polygon' | 'spline';
export type PresetName = 'default' | 'bw' | 'poster' | 'photo';

export const PRESETS: PresetName[] = ['default', 'bw', 'poster', 'photo'];

/**
 * Mirrors `TraceConfig` in `crates/vectrace-wasm/src/lib.rs`. Keep the two in step —
 * the Rust side is the source of truth for defaults and validation.
 */
export interface TraceParams {
	clustering: Clustering;
	hierarchical: Hierarchical;
	mode: FitMode;
	filterSpeckle: number;
	colorPrecision: number;
	layerDifference: number;
	cornerThreshold: number;
	lengthThreshold: number;
	maxIterations: number;
	spliceThreshold: number;
	/** Curve simplification tolerance in px; `null`/absent = off. */
	simplify?: number | null;
	/** Coordinate decimal places; `null`/absent = full precision. */
	pathPrecision?: number | null;
	/** Fixed palette as `#rrggbb`; takes priority over `maxColors`. */
	palette: string[];
	maxColors?: number | null;
	optimize: number;
	binaryThreshold: number;
	binaryAdaptive: boolean;
	binaryAdaptiveWindow: number;
	binaryAdaptiveT: number;
	watershedDetail: number;
	svgRelative: boolean;
	svgShorthands: boolean;
}

/**
 * Potrace's parameters, as exposed by `esm-potrace-wasm`.
 *
 * Potrace is monochrome at heart; `extractcolors` runs it once per posterized colour
 * level and stacks the results.
 */
export interface PotraceParams {
	/** Suppress speckles up to this area, in pixels. */
	turdsize: number;
	/** Corner threshold: 0 keeps every corner, 1.334 is the practical maximum. */
	alphamax: number;
	/** Run the curve optimizer. */
	opticurve: boolean;
	/** Optimizer tolerance; larger joins more segments into one curve. */
	opttolerance: number;
	/** Ambiguous-turn resolution: 0 black, 1 white, 2 left, 3 right, 4 minority, 5 majority. */
	turnpolicy: number;
	/** Trace colours rather than pure black and white. */
	extractcolors: boolean;
	/** Number of colour levels when `extractcolors` is on. */
	posterizelevel: number;
}

/** Whatever the selected engine takes. Only the engine itself interprets these. */
export type AnyParams = Record<string, unknown>;

/** Which pipeline stage a progress update belongs to. */
export type Phase = 'segment' | 'compose' | 'optimize';

export interface TraceOutput {
	svg: string;
	width: number;
	height: number;
	shapeCount: number;
}

/**
 * Whether a render is a throwaway preview (traced from a downscaled copy for
 * responsiveness) or the real full-resolution output.
 */
export type RenderTarget = 'preview' | 'full';
