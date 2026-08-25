import { describe, expect, it } from 'vitest';
import type { AnyParams, TraceParams } from '$lib/engines/types';
import { decode, diff, encode } from './urlParams';

const DEFAULTS: TraceParams & AnyParams = {
	clustering: 'color',
	hierarchical: 'stacked',
	mode: 'spline',
	filterSpeckle: 4,
	colorPrecision: 6,
	layerDifference: 16,
	cornerThreshold: 60,
	lengthThreshold: 4,
	maxIterations: 10,
	spliceThreshold: 45,
	simplify: null,
	pathPrecision: 2,
	palette: [],
	maxColors: null,
	optimize: 1,
	binaryThreshold: 128,
	binaryAdaptive: false,
	binaryAdaptiveWindow: 0,
	binaryAdaptiveT: 15,
	watershedDetail: 128,
	svgRelative: true,
	svgShorthands: true
};

describe('diff', () => {
	it('reports only what changed', () => {
		expect(diff({ ...DEFAULTS, colorPrecision: 4 }, DEFAULTS)).toEqual({ colorPrecision: 4 });
	});

	it('compares arrays by value, not identity', () => {
		expect(diff({ ...DEFAULTS, palette: [] }, DEFAULTS)).toEqual({});
		expect(diff({ ...DEFAULTS, palette: ['#ff0000'] }, DEFAULTS)).toEqual({ palette: ['#ff0000'] });
	});
});

describe('encode/decode', () => {
	it('round-trips an engine, preset and overrides', () => {
		const shared = {
			engine: 'vtracer' as const,
			preset: 'poster' as const,
			overrides: { colorPrecision: 4 }
		};
		expect(decode(encode(shared), DEFAULTS)).toEqual(shared);
	});

	it('omits the defaults and produces an empty hash when nothing differs', () => {
		expect(encode({ engine: 'vtracer', preset: 'default', overrides: {} })).toBe('');
	});

	it('round-trips a switched-off optional parameter as null, not zero', () => {
		const shared = {
			engine: 'vtracer' as const,
			preset: 'default' as const,
			overrides: { pathPrecision: null }
		};
		expect(decode(encode(shared), DEFAULTS).overrides.pathPrecision).toBeNull();
	});

	it('preserves booleans', () => {
		const shared = {
			engine: 'vtracer' as const,
			preset: 'default' as const,
			overrides: { binaryAdaptive: true }
		};
		expect(decode(encode(shared), DEFAULTS).overrides).toEqual({ binaryAdaptive: true });
	});

	it('drops unknown keys and unparseable numbers', () => {
		const decoded = decode('#nope=1&colorPrecision=banana&mode=polygon', DEFAULTS);
		expect(decoded.overrides).toEqual({ mode: 'polygon' });
	});

	it('falls back to the defaults for an unknown engine or preset', () => {
		expect(decode('#p=nonsense&e=nonsense', DEFAULTS)).toMatchObject({
			engine: 'vtracer',
			preset: 'default'
		});
	});

	it('carries the potrace engine', () => {
		expect(decode('#e=potrace&turdsize=8', { turdsize: 2 })).toEqual({
			engine: 'potrace',
			preset: 'default',
			overrides: { turdsize: 8 }
		});
	});
});
