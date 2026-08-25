/**
 * Encode tuning parameters into the URL hash so a set of settings can be shared.
 *
 * Only values that differ from the preset's defaults are written, which keeps the hash
 * short and — more usefully — means a link stays meaningful if upstream changes a default.
 */

import type { AnyParams, EngineId, PresetName } from '$lib/engines/types';
import { ENGINES, PRESETS } from '$lib/engines/types';

export interface Shared {
	engine: EngineId;
	preset: PresetName;
	/** Parameters that differ from the engine's defaults. */
	overrides: AnyParams;
}

export function encode({ engine, preset, overrides }: Shared): string {
	const q = new URLSearchParams();
	if (engine !== 'vtracer') q.set('e', engine);
	if (preset !== 'default') q.set('p', preset);
	for (const [k, v] of Object.entries(overrides)) {
		// `null` is meaningful for the optional parameters: it means "off".
		q.set(k, v === null ? '' : String(v));
	}
	const s = q.toString();
	return s ? `#${s}` : '';
}

export function diff(params: AnyParams, defaults: AnyParams): AnyParams {
	const out: AnyParams = {};
	for (const [k, v] of Object.entries(params)) {
		const d = defaults[k];
		if (Array.isArray(v) ? JSON.stringify(v) !== JSON.stringify(d) : v !== d) out[k] = v;
	}
	return out;
}

/**
 * Read a hash back. Values are coerced against `defaults`, so an unknown or malformed
 * key is dropped rather than poisoning the config that goes into wasm.
 */
export function decode(hash: string, defaults: AnyParams): Shared {
	const q = new URLSearchParams(hash.replace(/^#/, ''));

	const rawPreset = q.get('p');
	const preset = (PRESETS as string[]).includes(rawPreset ?? '')
		? (rawPreset as PresetName)
		: 'default';

	const rawEngine = q.get('e');
	const engine = ENGINES.some((e) => e.id === rawEngine) ? (rawEngine as EngineId) : 'vtracer';

	const overrides: AnyParams = {};
	for (const [k, v] of q) {
		if (k === 'p' || k === 'e') continue;
		if (!(k in defaults)) continue;

		const d = defaults[k];
		if (typeof d === 'boolean') {
			overrides[k] = v === 'true';
		} else if (typeof d === 'string') {
			overrides[k] = v;
		} else if (Array.isArray(d)) {
			overrides[k] = v ? v.split(',') : [];
		} else if (v === '') {
			// An empty value is how a switched-off optional parameter is written.
			overrides[k] = null;
		} else {
			const n = Number(v);
			if (Number.isFinite(n)) overrides[k] = n;
		}
	}

	return { engine, preset, overrides };
}
