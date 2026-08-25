/**
 * Application state for the single-image conversion flow.
 *
 * One instance per page. It owns the worker client and is the only place that decides
 * when to trace.
 */

import { POTRACE_DEFAULTS } from '$lib/engines/params';
import type { AnyParams, EngineId, Phase, PresetName } from '$lib/engines/types';
import { svgStats, type SvgStats } from '$lib/svg/stats';
import { TraceClient, type RenderResult } from '$lib/trace/client';
import { decode, diff, encode } from './urlParams';

export type Status = 'idle' | 'decoding' | 'tracing' | 'done' | 'error';

/** Above this, `createImageBitmap` output gets downscaled before it reaches the engine. */
export const MAX_SOURCE_EDGE = 4000;

/**
 * Trailing debounce on parameter edits. Long enough to swallow a slider drag, short
 * enough that a single click still feels immediate.
 */
export const RETRACE_DEBOUNCE_MS = 150;

export class TraceState {
	#client: TraceClient | null = null;

	status = $state<Status>('idle');
	error = $state<string | null>(null);

	/** Object URL of the source image, for the compare view. */
	sourceUrl = $state<string | null>(null);
	sourceName = $state<string | null>(null);
	sourceWidth = $state(0);
	sourceHeight = $state(0);
	/** Set when the source was too large and got scaled down before tracing. */
	downscaledFrom = $state<{ width: number; height: number } | null>(null);

	engine = $state<EngineId>('vtracer');
	preset = $state<PresetName>('default');
	params = $state<AnyParams | null>(null);
	/** The unmodified defaults for the current engine and preset, for diffing and reset. */
	#defaults: AnyParams | null = null;
	#debounce: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Set while a shared link is being applied. Loading an image has to wait for it,
	 * otherwise whichever `defaults()` round-trip finishes last wins and the link's
	 * settings are silently dropped.
	 */
	#initializing: Promise<void> | null = null;

	/** Run the SVGO pass after tracing. */
	svgo = $state(true);

	svg = $state<string | null>(null);
	/** Bytes before and after SVGO, when it ran on the current result. */
	optimized = $state<{ beforeBytes: number; afterBytes: number } | null>(null);
	/** True while `svg` came from the downscaled preview rather than the full image. */
	isPreview = $state(false);
	ms = $state(0);
	shapeCount = $state(0);
	progress = $state<{ phase: Phase; fraction: number } | null>(null);

	stats = $derived<SvgStats | null>(this.svg ? svgStats(this.svg) : null);
	get busy() {
		return this.status === 'decoding' || this.status === 'tracing';
	}

	/**
	 * `$state` hands out a Proxy, and the structured clone algorithm refuses to clone
	 * proxies — so params must be unwrapped before they can cross into the worker.
	 */
	#paramsSnapshot(): AnyParams {
		if (!this.params) throw new Error('no parameters loaded');
		return $state.snapshot(this.params) as AnyParams;
	}

	/**
	 * Defaults for an engine. vtracer owns its own, so they are read back out of wasm
	 * rather than duplicated here; potrace's live in the schema.
	 */
	async #defaultsFor(engine: EngineId, preset: PresetName): Promise<AnyParams> {
		if (engine === 'potrace') return { ...POTRACE_DEFAULTS };
		return (await this.#ensureClient().defaults(preset)) as unknown as AnyParams;
	}

	/** Switch engines, resetting to that engine's defaults. */
	async selectEngine(engine: EngineId) {
		if (engine === this.engine) return;
		try {
			this.engine = engine;
			this.#defaults = await this.#defaultsFor(engine, this.preset);
			this.params = { ...this.#defaults };
			this.#syncUrl();
			if (this.sourceUrl) this.retrace('preview');
		} catch (e) {
			this.#fail(e);
		}
	}

	/** Potrace has no presets of its own, so the preset buttons only apply to vtracer. */
	get supportsPresets() {
		return this.engine === 'vtracer';
	}

	#ensureClient(): TraceClient {
		if (!this.#client) {
			const client = new TraceClient();
			client.onResult = (r) => this.#accept(r);
			client.onError = (e) => this.#fail(e);
			this.#client = client;
		}
		return this.#client;
	}

	#accept(r: RenderResult) {
		this.svg = r.svg;
		this.optimized = r.optimized ?? null;
		this.isPreview = r.target === 'preview';
		this.ms = r.ms;
		this.shapeCount = r.shapeCount;
		this.progress = null;
		this.status = 'done';
	}

	#fail(e: unknown) {
		this.error = e instanceof Error ? e.message : String(e);
		this.status = 'error';
		this.progress = null;
	}

	/** Load the engine's defaults for a preset and re-trace if an image is loaded. */
	async selectPreset(preset: PresetName) {
		try {
			this.preset = preset;
			this.#defaults = await this.#defaultsFor(this.engine, preset);
			this.params = { ...this.#defaults };
			this.#syncUrl();
			if (this.sourceUrl) this.retrace('preview');
		} catch (e) {
			this.#fail(e);
		}
	}

	/** Discard tuning and go back to the current preset's defaults. */
	resetParams() {
		if (!this.#defaults) return;
		this.params = { ...this.#defaults };
		this.#syncUrl();
		if (this.sourceUrl) this.retrace('preview');
	}

	/** True when the current parameters still match the preset. */
	get isPristine() {
		if (!this.params || !this.#defaults) return true;
		return Object.keys(diff(this.params, this.#defaults)).length === 0;
	}

	/**
	 * Called by the tuning UI on every edit. Coalesces a slider drag into one render.
	 */
	paramsChanged() {
		this.#syncUrl();
		if (this.#debounce) clearTimeout(this.#debounce);
		this.#debounce = setTimeout(() => {
			this.#debounce = null;
			this.retrace('preview');
		}, RETRACE_DEBOUNCE_MS);
	}

	#syncUrl() {
		if (typeof location === 'undefined' || !this.params || !this.#defaults) return;
		const hash = encode({
			engine: this.engine,
			preset: this.preset,
			overrides: diff(this.#paramsSnapshot(), this.#defaults)
		});
		history.replaceState(null, '', hash || location.pathname + location.search);
	}

	/** Apply settings from a shared link. Safe to call before any image is loaded. */
	applyHash(hash: string): Promise<void> {
		if (!hash || hash === '#') return Promise.resolve();
		this.#initializing = this.#applyHash(hash).finally(() => (this.#initializing = null));
		return this.#initializing;
	}

	async #applyHash(hash: string) {
		try {
			// Two passes: the engine and preset decide which defaults the remaining values
			// are coerced against, so they have to be read first.
			const { engine, preset } = decode(hash, {});
			this.engine = engine;
			this.preset = preset;
			this.#defaults = await this.#defaultsFor(engine, preset);

			const { overrides } = decode(hash, this.#defaults);
			this.params = { ...this.#defaults, ...overrides };
			if (this.sourceUrl) this.retrace('preview');
		} catch (e) {
			this.#fail(e);
		}
	}

	async open(file: File) {
		this.status = 'decoding';
		this.error = null;
		this.downscaledFrom = null;

		try {
			if (this.#initializing) await this.#initializing;

			const client = this.#ensureClient();
			if (!this.params) {
				this.#defaults = await this.#defaultsFor(this.engine, this.preset);
				this.params = { ...this.#defaults };
			}

			let bitmap = await createImageBitmap(file);
			const longEdge = Math.max(bitmap.width, bitmap.height);
			if (longEdge > MAX_SOURCE_EDGE) {
				const original = { width: bitmap.width, height: bitmap.height };
				const scale = MAX_SOURCE_EDGE / longEdge;
				const scaled = await createImageBitmap(bitmap, {
					resizeWidth: Math.round(bitmap.width * scale),
					resizeHeight: Math.round(bitmap.height * scale),
					resizeQuality: 'high'
				});
				bitmap.close();
				bitmap = scaled;
				this.downscaledFrom = original;
			}

			if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
			this.sourceUrl = URL.createObjectURL(file);
			this.sourceName = file.name;

			const loaded = await client.load(bitmap);
			this.sourceWidth = loaded.width;
			this.sourceHeight = loaded.height;

			this.status = 'tracing';
			client.schedule(this.engine, this.#paramsSnapshot(), 'preview', this.svgo);
		} catch (e) {
			this.#fail(e);
		}
	}

	/** Re-trace with the current parameters. */
	retrace(target: 'preview' | 'full' = 'preview') {
		if (!this.params) return;
		this.status = 'tracing';
		this.#ensureClient().schedule(this.engine, this.#paramsSnapshot(), target, this.svgo);
	}

	/** Toggle the SVGO pass and re-trace. */
	setSvgo(on: boolean) {
		this.svgo = on;
		if (this.sourceUrl) this.retrace('preview');
	}

	/** Trace at full resolution — what the download should always be. */
	async renderFull(): Promise<string> {
		if (!this.params) throw new Error('nothing loaded');
		if (this.svg && !this.isPreview) return this.svg;

		this.status = 'tracing';
		const r = await this.#ensureClient().render(
			this.engine,
			this.#paramsSnapshot(),
			'full',
			this.svgo,
			(phase, fraction) => {
				this.progress = { phase, fraction };
			}
		);
		this.#accept(r);
		return r.svg;
	}

	reset() {
		if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
		this.sourceUrl = null;
		this.sourceName = null;
		this.svg = null;
		this.error = null;
		this.status = 'idle';
		this.downscaledFrom = null;
	}

	destroy() {
		if (this.#debounce) clearTimeout(this.#debounce);
		this.#client?.terminate();
		this.#client = null;
		if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
	}
}
