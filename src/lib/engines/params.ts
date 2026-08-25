/**
 * The parameter schema that drives the tuning UI.
 *
 * Describing the controls as data rather than hand-writing twenty sliders keeps the
 * relevance rules (which knob matters in which mode) in one readable place, and means a
 * second engine can supply its own schema to the same panel.
 */

import type { AnyParams, EngineId, TraceParams } from './types';

interface Base {
	key: string;
	label: string;
	help: string;
	/** Whether this control does anything for the current parameter set. */
	visible?: (p: AnyParams) => boolean;
}

export type Control = Base &
	(
		| { kind: 'select'; options: { value: string; label: string }[] }
		| { kind: 'toggle' }
		| { kind: 'range'; min: number; max: number; step: number }
		/** A range that can also be switched off entirely, mapping to `null`. */
		| { kind: 'optionalRange'; min: number; max: number; step: number; whenOff: string }
	);

export interface Group {
	title: string;
	controls: Control[];
}

const isColor = (p: AnyParams) => p.clustering === 'color';
const isBinary = (p: AnyParams) => p.clustering === 'binary';
const isWatershed = (p: AnyParams) => p.clustering === 'watershed';
/** Corner and curve parameters only exist once outlines are fitted, not for raw pixels. */
const isFitted = (p: AnyParams) => p.mode !== 'pixel';
const isSpline = (p: AnyParams) => p.mode === 'spline';

const VTRACER_GROUPS: Group[] = [
	{
		title: 'Segmentation',
		controls: [
			{
				key: 'clustering',
				label: 'Clustering',
				help: 'How the image is divided into regions before any curves are fitted.',
				kind: 'select',
				options: [
					{ value: 'color', label: 'Colour clusters' },
					{ value: 'binary', label: 'Black and white' },
					{ value: 'watershed', label: 'Watershed' }
				]
			},
			{
				key: 'colorPrecision',
				label: 'Colour precision',
				help: 'Significant bits kept per RGB channel. Lower merges more shades together.',
				kind: 'range',
				min: 1,
				max: 8,
				step: 1,
				visible: isColor
			},
			{
				key: 'layerDifference',
				label: 'Layer difference',
				help: 'How far apart two colours must be to become separate gradient layers.',
				kind: 'range',
				min: 0,
				max: 64,
				step: 1,
				visible: isColor
			},
			{
				key: 'filterSpeckle',
				label: 'Filter speckle',
				help: 'Discard regions smaller than this many pixels on a side. Cleans up noise.',
				kind: 'range',
				min: 0,
				max: 32,
				step: 1
			},
			{
				key: 'binaryAdaptive',
				label: 'Adaptive threshold',
				help: 'Threshold against the local neighbourhood instead of one global cutoff. Better under uneven lighting.',
				kind: 'toggle',
				visible: isBinary
			},
			{
				key: 'binaryThreshold',
				label: 'Threshold',
				help: 'Pixels darker than this become foreground.',
				kind: 'range',
				min: 0,
				max: 255,
				step: 1,
				visible: (p) => isBinary(p) && !p.binaryAdaptive
			},
			{
				key: 'binaryAdaptiveWindow',
				label: 'Adaptive window',
				help: 'Side length of the local neighbourhood in pixels. 0 picks one automatically.',
				kind: 'range',
				min: 0,
				max: 256,
				step: 4,
				visible: (p) => isBinary(p) && Boolean(p.binaryAdaptive)
			},
			{
				key: 'binaryAdaptiveT',
				label: 'Adaptive sensitivity',
				help: 'How far below the local mean a pixel must fall, as a percentage.',
				kind: 'range',
				min: 0,
				max: 50,
				step: 1,
				visible: (p) => isBinary(p) && Boolean(p.binaryAdaptive)
			},
			{
				key: 'watershedDetail',
				label: 'Watershed detail',
				help: 'Where to cut the region hierarchy. Higher keeps more, smaller regions.',
				kind: 'range',
				min: 0,
				max: 255,
				step: 1,
				visible: isWatershed
			}
		]
	},
	{
		title: 'Curves',
		controls: [
			{
				key: 'mode',
				label: 'Fit mode',
				help: 'Pixel keeps the staircase, polygon fits straight edges, spline fits curves.',
				kind: 'select',
				options: [
					{ value: 'spline', label: 'Spline' },
					{ value: 'polygon', label: 'Polygon' },
					{ value: 'pixel', label: 'Pixel' }
				]
			},
			{
				key: 'cornerThreshold',
				label: 'Corner threshold',
				help: 'Angles sharper than this stay as corners instead of being smoothed.',
				kind: 'range',
				min: 0,
				max: 180,
				step: 1,
				visible: isFitted
			},
			{
				key: 'lengthThreshold',
				label: 'Length threshold',
				help: 'Shortest segment worth keeping, in pixels.',
				kind: 'range',
				min: 0,
				max: 16,
				step: 0.5,
				visible: isFitted
			},
			{
				key: 'spliceThreshold',
				label: 'Splice threshold',
				help: 'Angle at which two fitted curves are joined rather than left separate.',
				kind: 'range',
				min: 0,
				max: 180,
				step: 1,
				visible: isSpline
			},
			{
				key: 'maxIterations',
				label: 'Max iterations',
				help: 'Effort spent refining each curve fit.',
				kind: 'range',
				min: 1,
				max: 20,
				step: 1,
				visible: isSpline
			},
			{
				key: 'simplify',
				label: 'Simplify',
				help: 'Re-fit smooth runs with fewer curves, staying within this many pixels of the original.',
				kind: 'optionalRange',
				min: 0.1,
				max: 8,
				step: 0.1,
				whenOff: 'off',
				visible: isSpline
			}
		]
	},
	{
		title: 'Output',
		controls: [
			{
				key: 'maxColors',
				label: 'Max colours',
				help: 'Quantize the palette down to at most this many colours.',
				kind: 'optionalRange',
				min: 2,
				max: 64,
				step: 1,
				whenOff: 'unlimited'
			},
			{
				key: 'optimize',
				label: 'Optimize',
				help: '0 off, 1 quantize and clean up, 2 also use shorthands and grouping.',
				kind: 'range',
				min: 0,
				max: 2,
				step: 1
			},
			{
				key: 'pathPrecision',
				label: 'Coordinate precision',
				help: 'Decimal places kept in path data. Fewer means a smaller file.',
				kind: 'optionalRange',
				min: 0,
				max: 6,
				step: 1,
				whenOff: 'full'
			}
		]
	}
];

const POTRACE_GROUPS: Group[] = [
	{
		title: 'Tracing',
		controls: [
			{
				key: 'turdsize',
				label: 'Speckle size',
				help: 'Drop any shape smaller than this area, in pixels.',
				kind: 'range',
				min: 0,
				max: 64,
				step: 1
			},
			{
				key: 'alphamax',
				label: 'Corner threshold',
				help: '0 keeps every corner sharp; 1.334 smooths everything it can.',
				kind: 'range',
				min: 0,
				max: 1.334,
				step: 0.033
			},
			{
				key: 'turnpolicy',
				label: 'Turn policy',
				help: 'How to resolve ambiguous pixel junctions when following an outline.',
				kind: 'select',
				options: [
					{ value: '4', label: 'Minority' },
					{ value: '5', label: 'Majority' },
					{ value: '0', label: 'Black' },
					{ value: '1', label: 'White' },
					{ value: '2', label: 'Left' },
					{ value: '3', label: 'Right' }
				]
			}
		]
	},
	{
		title: 'Curves',
		controls: [
			{
				key: 'opticurve',
				label: 'Optimize curves',
				help: 'Join adjacent segments into longer curves where the shape allows.',
				kind: 'toggle'
			},
			{
				key: 'opttolerance',
				label: 'Optimizer tolerance',
				help: 'How far the optimized curve may stray from the traced one.',
				kind: 'range',
				min: 0,
				max: 1,
				step: 0.01,
				visible: (p) => Boolean(p.opticurve)
			}
		]
	},
	{
		title: 'Colour',
		controls: [
			{
				key: 'extractcolors',
				label: 'Trace colours',
				help: 'Posterize and trace each colour level, instead of pure black and white.',
				kind: 'toggle'
			},
			{
				key: 'posterizelevel',
				label: 'Colour levels',
				help: 'How many levels to posterize down to before tracing.',
				kind: 'range',
				min: 1,
				max: 8,
				step: 1,
				visible: (p) => Boolean(p.extractcolors)
			}
		]
	}
];

/**
 * Shown for every engine, above the engine's own controls: both engines decide what is
 * ink and what is paper by brightness alone, which is the wrong question for a logo whose
 * colours differ in hue, or whose fill carries a gradient.
 */
const PREPARE_GROUP: Group = {
	title: 'Black & white',
	controls: [
		{
			key: 'binarize',
			label: 'Separate by',
			help: 'Reduce the image to two tones before tracing. Colour clusters the two dominant colours, so it copes with gradients and with marks that contrast in hue rather than brightness.',
			kind: 'select',
			options: [
				{ value: 'off', label: 'Off — trace as-is' },
				{ value: 'colour', label: 'Colour (recommended)' },
				{ value: 'luminance', label: 'Brightness' }
			]
		},
		{
			key: 'invert',
			label: 'Invert',
			help: 'Swap the mark and the ground, for light artwork on a dark background.',
			kind: 'toggle',
			visible: (p) => p.binarize !== 'off'
		}
	]
};

export function groupsFor(engine: EngineId): Group[] {
	return [PREPARE_GROUP, ...(engine === 'potrace' ? POTRACE_GROUPS : VTRACER_GROUPS)];
}

/** Preprocessing defaults, merged into whatever the engine supplies. */
export const PREPARE_DEFAULTS = { binarize: 'off', invert: false };

/** Potrace has no wasm-side defaults to ask for, so they live here. */
export const POTRACE_DEFAULTS = {
	turdsize: 2,
	alphamax: 1,
	opticurve: true,
	opttolerance: 0.2,
	turnpolicy: 4,
	extractcolors: true,
	posterizelevel: 2
};

/** Default value to restore when an optional control is switched back on. */
export function defaultFor(control: Control): number {
	if (control.kind !== 'optionalRange') throw new Error('only optional controls need this');
	return control.key === 'maxColors' ? 16 : control.key === 'pathPrecision' ? 2 : 1;
}

// Keeps the vtracer schema honest: every control must name a real parameter.
export type VTracerKey = keyof TraceParams;
