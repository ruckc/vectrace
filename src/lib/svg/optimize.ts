/**
 * Post-trace SVG optimization.
 *
 * vtracer already trims what it can (`optimize`, `pathPrecision`, `simplify`), so SVGO's
 * job here is the structural leftovers: redundant attributes, mergeable groups, tidier
 * path data. The plugin list is the default preset minus anything that can change how the
 * file renders or how it behaves once embedded elsewhere.
 */

import { optimize as svgo, type Config } from 'svgo/browser';

export const SVGO_CONFIG: Config = {
	multipass: true,
	plugins: [
		{
			name: 'preset-default',
			params: {
				overrides: {
					// The viewBox is what makes the output scale when embedded. vtracer emits
					// width/height, so dropping it would pin the SVG to one size.
					removeViewBox: false,
					// Ids may be referenced from outside once the SVG is pasted into a page.
					cleanupIds: false,
					// Precision is the user's call, via the `pathPrecision` parameter.
					convertPathData: { floatPrecision: 3 },
					cleanupNumericValues: { floatPrecision: 3 }
				}
			}
		}
	]
};

export interface Optimized {
	svg: string;
	beforeBytes: number;
	afterBytes: number;
}

const size = (s: string) => new TextEncoder().encode(s).length;

/**
 * Returns the original untouched if SVGO fails or makes the file bigger — neither is
 * worth failing a conversion over.
 */
export function optimizeSvg(svg: string): Optimized {
	const beforeBytes = size(svg);
	try {
		const out = svgo(svg, SVGO_CONFIG).data;
		const afterBytes = size(out);
		if (afterBytes >= beforeBytes) return { svg, beforeBytes, afterBytes: beforeBytes };
		return { svg: out, beforeBytes, afterBytes };
	} catch {
		return { svg, beforeBytes, afterBytes: beforeBytes };
	}
}
