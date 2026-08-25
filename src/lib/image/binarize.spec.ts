import { describe, expect, it } from 'vitest';
import { binarize, dominantPair, luma, otsuThreshold } from './binarize';

const W = 64;
const H = 64;

const lerp = (a: number[], b: number[], t: number) =>
	a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * A mark on a ground, each side carrying its own vertical gradient — the shape of the
 * real-world case this module exists for.
 */
function scene(bg0: number[], bg1: number[], fg0: number[], fg1: number[], alpha = 255) {
	const px = new Uint8ClampedArray(W * H * 4);
	const truth = new Uint8Array(W * H);
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4;
			const t = y / (H - 1);
			// A ring: hollow, so a correct mask has to get the interior right too.
			const d = Math.hypot(x - W / 2, y - H / 2);
			const isFg = d < 22 && d > 12;
			truth[y * W + x] = isFg ? 1 : 0;
			const c = isFg ? lerp(fg0, fg1, t) : lerp(bg0, bg1, t);
			px[i] = c[0];
			px[i + 1] = c[1];
			px[i + 2] = c[2];
			px[i + 3] = isFg ? 255 : alpha;
		}
	}
	return { px, truth };
}

/** Fraction of pixels matching the truth mask; the mask is allowed to be inverted. */
function accuracy(out: Uint8ClampedArray, truth: Uint8Array) {
	let black = 0;
	for (let i = 0, j = 0; i < out.length; i += 4, j++) {
		if ((out[i] === 0 ? 1 : 0) === truth[j]) black++;
	}
	return Math.max(black, truth.length - black) / truth.length;
}

describe('otsuThreshold', () => {
	it('lands between the two class means', () => {
		// Foreground 20..60 (mean 40), background 220..255 (mean ~237).
		const { px } = scene([255, 255, 255], [220, 220, 220], [20, 20, 20], [60, 60, 60]);
		const t = otsuThreshold(px);
		expect(t).toBeGreaterThan(40);
		expect(t).toBeLessThan(237);
	});
});

describe('dominantPair', () => {
	it('returns the darker centroid first', () => {
		const { px } = scene([240, 240, 240], [240, 240, 240], [10, 10, 10], [10, 10, 10]);
		const [dark, light] = dominantPair(px);
		expect(luma(...dark)).toBeLessThan(luma(...light));
	});

	it('recovers both colours despite gradients on each', () => {
		const { px } = scene([200, 60, 40], [240, 100, 80], [30, 90, 200], [70, 130, 240]);
		const [dark, light] = dominantPair(px);
		// Blue-ish and red-ish, not two greys.
		expect(dark[2]).toBeGreaterThan(dark[0]);
		expect(light[0]).toBeGreaterThan(light[2]);
	});
});

describe('binarize', () => {
	it('is exact when the mark is clearly darker than the ground', () => {
		const { px, truth } = scene([255, 255, 255], [210, 210, 210], [30, 30, 30], [90, 90, 90]);
		expect(accuracy(binarize(px, 'colour').data, truth)).toBe(1);
		// Otsu maximizes between-class variance, which on a graded foreground can place the
		// cut just inside the mark's own range and shave its darkest rows. Close, not exact —
		// this is the reason 'colour' is the default rather than 'luminance'.
		expect(accuracy(binarize(px, 'luminance').data, truth)).toBeGreaterThan(0.98);
	});

	it('survives a foreground gradient that crosses the midpoint', () => {
		// Foreground runs 64→176, straddling the fixed cutoff of 128 that the engines use.
		const { px, truth } = scene([255, 255, 255], [192, 192, 192], [64, 64, 64], [176, 176, 176]);
		expect(accuracy(binarize(px, 'colour').data, truth)).toBe(1);
	});

	it('separates colours that contrast in hue but not in brightness', () => {
		// Near-identical luma, so any grayscale threshold has nothing to work with.
		const { px, truth } = scene([200, 120, 120], [210, 130, 130], [120, 171, 171], [130, 181, 181]);
		expect(accuracy(binarize(px, 'colour').data, truth)).toBe(1);
	});

	it('emits only pure black and white, fully opaque', () => {
		const { px } = scene([200, 60, 40], [240, 100, 80], [30, 90, 200], [70, 130, 240]);
		const { data } = binarize(px, 'colour');
		for (let i = 0; i < data.length; i += 4) {
			expect(data[i] === 0 || data[i] === 255).toBe(true);
			expect(data[i]).toBe(data[i + 1]);
			expect(data[i + 1]).toBe(data[i + 2]);
			expect(data[i + 3]).toBe(255);
		}
	});

	it('treats fully transparent pixels as background', () => {
		// A transparent ground whose RGB happens to be black: without the alpha check it
		// would be classified as foreground and swamp the mark.
		const { px, truth } = scene([0, 0, 0], [0, 0, 0], [30, 90, 200], [70, 130, 240], 0);
		const { data, foregroundRatio } = binarize(px, 'colour');
		expect(accuracy(data, truth)).toBe(1);
		expect(foregroundRatio).toBeLessThan(0.5);
	});

	it('invert swaps which side becomes black', () => {
		const { px } = scene([255, 255, 255], [210, 210, 210], [30, 30, 30], [90, 90, 90]);
		const normal = binarize(px, 'colour');
		const inverted = binarize(px, 'colour', true);
		expect(inverted.foregroundRatio).toBeCloseTo(1 - normal.foregroundRatio, 5);
	});
});
