/**
 * Reduce an image to two tones before it reaches a tracing engine.
 *
 * Both engines threshold on *brightness*: vtracer's binary mode compares grayscale
 * intensity to a cutoff, and potrace is monochrome by nature. That fails on two very
 * common kinds of logo:
 *
 *   - a subtle gradient on the foreground that straddles the cutoff, so half the mark
 *     is classified as background;
 *   - colours that contrast strongly to the eye but sit at nearly the same luminance,
 *     so converting to grayscale destroys the very difference that separates them.
 *
 * `colour` mode solves both by clustering in RGB instead: it finds the two dominant
 * colours and assigns every pixel to the nearer one. A gradient forms a cloud around its
 * centroid rather than crossing a line, and hue differences survive because nothing is
 * flattened to grey.
 *
 * `luminance` mode is Otsu's method — cheaper, and the better choice when the image really
 * is light-on-dark and you want the classic behaviour.
 */

export type BinarizeMode = 'off' | 'colour' | 'luminance';

/** Rec. 601 luma, matching what the engines use internally. */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Bits per channel kept when histogramming for k-means. 5 → 32768 buckets. */
const HIST_BITS = 5;
const HIST_SIZE = 1 << (HIST_BITS * 3);
const SHIFT = 8 - HIST_BITS;

/**
 * Otsu's method: the luminance cutoff that maximizes between-class variance.
 * Exported for testing and for the stats readout.
 */
export function otsuThreshold(rgba: Uint8ClampedArray | Uint8Array): number {
	const hist = new Uint32Array(256);
	for (let i = 0; i < rgba.length; i += 4) {
		hist[Math.round(luma(rgba[i], rgba[i + 1], rgba[i + 2]))]++;
	}

	const total = rgba.length / 4;
	let sum = 0;
	for (let t = 0; t < 256; t++) sum += t * hist[t];

	let sumB = 0;
	let weightB = 0;
	let best = 128;
	let bestVariance = -1;

	for (let t = 0; t < 256; t++) {
		weightB += hist[t];
		if (weightB === 0) continue;
		const weightF = total - weightB;
		if (weightF === 0) break;

		sumB += t * hist[t];
		const meanB = sumB / weightB;
		const meanF = (sum - sumB) / weightF;
		const variance = weightB * weightF * (meanB - meanF) ** 2;

		if (variance > bestVariance) {
			bestVariance = variance;
			best = t;
		}
	}

	return best;
}

/**
 * The two dominant colours, by k-means over a quantized colour histogram.
 *
 * Clustering the histogram rather than the pixels keeps this O(buckets) per iteration
 * instead of O(pixels), so a 4000px image costs the same as a 400px one after the single
 * counting pass.
 */
export function dominantPair(
	rgba: Uint8ClampedArray | Uint8Array
): [[number, number, number], [number, number, number]] {
	const counts = new Uint32Array(HIST_SIZE);
	for (let i = 0; i < rgba.length; i += 4) {
		// Fully transparent pixels carry meaningless RGB — usually (0,0,0), which would
		// otherwise drag a centroid to black and swallow a dark mark.
		if (rgba[i + 3] === 0) continue;
		const key =
			((rgba[i] >> SHIFT) << (HIST_BITS * 2)) |
			((rgba[i + 1] >> SHIFT) << HIST_BITS) |
			(rgba[i + 2] >> SHIFT);
		counts[key]++;
	}

	// Collect the occupied buckets, with their centre colour and weight.
	const cr: number[] = [];
	const cg: number[] = [];
	const cb: number[] = [];
	const cw: number[] = [];
	const half = (1 << SHIFT) >> 1;
	for (let key = 0; key < HIST_SIZE; key++) {
		const w = counts[key];
		if (w === 0) continue;
		cr.push((((key >> (HIST_BITS * 2)) & ((1 << HIST_BITS) - 1)) << SHIFT) + half);
		cg.push((((key >> HIST_BITS) & ((1 << HIST_BITS) - 1)) << SHIFT) + half);
		cb.push(((key & ((1 << HIST_BITS) - 1)) << SHIFT) + half);
		cw.push(w);
	}

	// Seed with the darkest and lightest occupied buckets: for the two-tone images this
	// is meant for, they land in opposite clusters and k-means converges in a few passes.
	let darkest = 0;
	let lightest = 0;
	for (let i = 1; i < cr.length; i++) {
		if (luma(cr[i], cg[i], cb[i]) < luma(cr[darkest], cg[darkest], cb[darkest])) darkest = i;
		if (luma(cr[i], cg[i], cb[i]) > luma(cr[lightest], cg[lightest], cb[lightest])) lightest = i;
	}

	let a: [number, number, number] = [cr[darkest], cg[darkest], cb[darkest]];
	let b: [number, number, number] = [cr[lightest], cg[lightest], cb[lightest]];

	for (let iter = 0; iter < 16; iter++) {
		let ar = 0,
			ag = 0,
			ab = 0,
			an = 0,
			br = 0,
			bg = 0,
			bb = 0,
			bn = 0;

		for (let i = 0; i < cr.length; i++) {
			const w = cw[i];
			const da = (cr[i] - a[0]) ** 2 + (cg[i] - a[1]) ** 2 + (cb[i] - a[2]) ** 2;
			const db = (cr[i] - b[0]) ** 2 + (cg[i] - b[1]) ** 2 + (cb[i] - b[2]) ** 2;
			if (da <= db) {
				ar += cr[i] * w;
				ag += cg[i] * w;
				ab += cb[i] * w;
				an += w;
			} else {
				br += cr[i] * w;
				bg += cg[i] * w;
				bb += cb[i] * w;
				bn += w;
			}
		}

		const nextA: [number, number, number] = an ? [ar / an, ag / an, ab / an] : a;
		const nextB: [number, number, number] = bn ? [br / bn, bg / bn, bb / bn] : b;
		const moved =
			Math.abs(nextA[0] - a[0]) +
			Math.abs(nextA[1] - a[1]) +
			Math.abs(nextA[2] - a[2]) +
			Math.abs(nextB[0] - b[0]) +
			Math.abs(nextB[1] - b[1]) +
			Math.abs(nextB[2] - b[2]);
		a = nextA;
		b = nextB;
		if (moved < 0.5) break;
	}

	// Darker centroid first, so callers can rely on a[] being the foreground candidate.
	return luma(...a) <= luma(...b) ? [a, b] : [b, a];
}

export interface BinarizeResult {
	data: Uint8ClampedArray;
	/** Share of pixels that ended up as foreground, for sanity-checking the result. */
	foregroundRatio: number;
}

/**
 * Produce a pure black-and-white copy. Foreground becomes black, which is what both
 * engines expect; `invert` swaps that for light marks on dark grounds.
 *
 * Fully transparent pixels are treated as background regardless of their colour, since a
 * transparent PNG carries meaningless RGB where alpha is zero.
 */
export function binarize(
	rgba: Uint8ClampedArray | Uint8Array,
	mode: Exclude<BinarizeMode, 'off'>,
	invert = false
): BinarizeResult {
	const out = new Uint8ClampedArray(rgba.length);
	const pixels = rgba.length / 4;
	let foreground = 0;

	let transparent = 0;
	for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparent++;

	// When an image carries real transparency, alpha already says what the mark is —
	// that is the whole point of a cut-out logo. Clustering its colours instead would
	// split the mark's own gradient in two and produce nonsense.
	const alphaDefinesMark = transparent > pixels * 0.01;

	let isForeground: (i: number) => boolean;
	if (alphaDefinesMark) {
		isForeground = (i) => rgba[i + 3] > 0;
	} else if (mode === 'luminance') {
		const t = otsuThreshold(rgba);
		isForeground = (i) => luma(rgba[i], rgba[i + 1], rgba[i + 2]) <= t;
	} else {
		const [dark, light] = dominantPair(rgba);
		isForeground = (i) => {
			const r = rgba[i];
			const g = rgba[i + 1];
			const b = rgba[i + 2];
			const dDark = (r - dark[0]) ** 2 + (g - dark[1]) ** 2 + (b - dark[2]) ** 2;
			const dLight = (r - light[0]) ** 2 + (g - light[1]) ** 2 + (b - light[2]) ** 2;
			return dDark <= dLight;
		};
	}

	for (let i = 0; i < rgba.length; i += 4) {
		const black = isForeground(i) !== invert;
		out[i] = out[i + 1] = out[i + 2] = black ? 0 : 255;
		out[i + 3] = 255;
		if (black) foreground++;
	}

	return { data: out, foregroundRatio: foreground / pixels };
}
