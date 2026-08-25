/**
 * The potrace engine.
 *
 * potrace is GPL-2.0-or-later, and it is the reason this project is GPL rather than MIT
 * (see NOTICE). It earns its place on black-and-white line art, where its curve fitting is
 * still hard to beat.
 *
 * Unlike vtracer there is no session to cache — potrace re-traces from scratch every time,
 * so tuning it is slower on large images.
 */

import { init, potrace } from 'esm-potrace-wasm';
import type { AnyParams, TraceOutput } from './types';

let ready: Promise<void> | null = null;

/** The wasm module is only fetched the first time someone picks this engine. */
function ensureReady(): Promise<void> {
	ready ??= init();
	return ready;
}

/** potrace emits no width/height, which the compare view needs, so they are patched in. */
function withDimensions(svg: string, width: number, height: number): string {
	if (/<svg[^>]*\swidth=/.test(svg)) return svg;
	return svg.replace(/<svg\b/, `<svg width="${width}" height="${height}"`);
}

export async function trace(image: ImageData, params: AnyParams): Promise<TraceOutput> {
	await ensureReady();

	const svg = await potrace(image, {
		turdsize: Number(params.turdsize ?? 2),
		turnpolicy: Number(params.turnpolicy ?? 4),
		alphamax: Number(params.alphamax ?? 1),
		// The binding takes 0/1 rather than a boolean here.
		opticurve: params.opticurve === false ? 0 : 1,
		opttolerance: Number(params.opttolerance ?? 0.2),
		extractcolors: Boolean(params.extractcolors),
		posterizelevel: Number(params.posterizelevel ?? 2)
	});

	return {
		svg: withDimensions(svg, image.width, image.height),
		width: image.width,
		height: image.height,
		shapeCount: svg.match(/<path\b/g)?.length ?? 0
	};
}
