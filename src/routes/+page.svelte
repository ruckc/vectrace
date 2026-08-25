<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CompareView from '$lib/components/CompareView.svelte';
	import Dropzone from '$lib/components/Dropzone.svelte';
	import ExportBar from '$lib/components/ExportBar.svelte';
	import ParamPanel from '$lib/components/ParamPanel.svelte';
	import StatsBar from '$lib/components/StatsBar.svelte';
	import { groupsFor } from '$lib/engines/params';
	import { ENGINES, PRESETS } from '$lib/engines/types';
	import { TraceState } from '$lib/state/trace.svelte';

	const trace = new TraceState();

	// Deliberately not awaited: onMount must return a cleanup function, not a promise.
	onMount(() => {
		void trace.applyHash(location.hash);
	});
	onDestroy(() => trace.destroy());
</script>

<svelte:head>
	<title>vectrace — image to SVG, in your browser</title>
	<meta
		name="description"
		content="Convert PNG, JPG, WebP and GIF images to SVG entirely in your browser. Nothing is uploaded."
	/>
</svelte:head>

<main>
	<header>
		<div>
			<h1>vectrace</h1>
			<p>Raster images to SVG, entirely in your browser. Nothing is uploaded.</p>
		</div>
		<a class="github" href="https://github.com/ruckc/vectrace" aria-label="vectrace on GitHub">
			<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
				<path
					d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
				/>
			</svg>
			GitHub
		</a>
	</header>

	{#if !trace.sourceUrl}
		<Dropzone onfile={(f) => trace.open(f)} disabled={trace.busy} />
	{:else}
		<div class="controls">
			<div class="presets" role="group" aria-label="Engine">
				{#each ENGINES as e (e.id)}
					<button
						class:active={trace.engine === e.id}
						title="{e.blurb} ({e.license})"
						onclick={() => trace.selectEngine(e.id)}
					>
						{e.label}
					</button>
				{/each}
			</div>
			{#if trace.supportsPresets}
				<div class="presets" role="group" aria-label="Preset">
					{#each PRESETS as preset (preset)}
						<button
							class:active={trace.preset === preset}
							onclick={() => trace.selectPreset(preset)}
						>
							{preset}
						</button>
					{/each}
				</div>
			{/if}
			<button class="link" onclick={() => trace.reset()}>Use a different image</button>
		</div>

		<div class="layout">
			<div class="result">
				<CompareView
					sourceUrl={trace.sourceUrl}
					svg={trace.svg}
					width={trace.sourceWidth}
					height={trace.sourceHeight}
				/>

				{#if trace.progress}
					<p class="progress">
						{trace.progress.phase}
						{(trace.progress.fraction * 100).toFixed(0)}%
					</p>
				{:else if trace.busy}
					<p class="progress">Tracing…</p>
				{/if}

				<StatsBar
					stats={trace.stats}
					shapeCount={trace.shapeCount}
					ms={trace.ms}
					isPreview={trace.isPreview}
					sourceWidth={trace.sourceWidth}
					sourceHeight={trace.sourceHeight}
					optimized={trace.optimized}
				/>

				{#if trace.downscaledFrom}
					<p class="warn">
						Source was {trace.downscaledFrom.width} × {trace.downscaledFrom.height} and was scaled down
						to {trace.sourceWidth} × {trace.sourceHeight} before tracing.
					</p>
				{/if}

				<ExportBar
					getSvg={() => trace.renderFull()}
					filename={trace.sourceName ?? 'image'}
					disabled={!trace.svg}
				/>
			</div>

			{#if trace.params}
				<aside>
					<div class="aside-head">
						<h2>Parameters</h2>
						<button class="link" disabled={trace.isPristine} onclick={() => trace.resetParams()}>
							Reset
						</button>
					</div>
					<ParamPanel
						bind:params={trace.params}
						groups={groupsFor(trace.engine)}
						onchange={() => trace.paramsChanged()}
					/>

					<label class="svgo">
						<input
							type="checkbox"
							checked={trace.svgo}
							onchange={(e) => trace.setSvgo(e.currentTarget.checked)}
						/>
						Optimize with SVGO
					</label>
				</aside>
			{/if}
		</div>
	{/if}

	{#if trace.error}
		<p class="error" role="alert">{trace.error}</p>
	{/if}

	<footer>
		<a href="https://github.com/visioncortex/vtracer">VTracer</a> and
		<a href="https://potrace.sourceforge.net/">Potrace</a>, compiled to WebAssembly and run in your
		browser. GPL-2.0-or-later —
		<a href="https://github.com/ruckc/vectrace">source</a>.
	</footer>
</main>

<style>
	:global(html) {
		color-scheme: light dark;
	}

	:global(body) {
		margin: 0;
		background: light-dark(#fff, #141414);
		color: light-dark(#1a1a1a, #eaeaea);
	}

	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		font-family: system-ui, sans-serif;
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	header p {
		color: light-dark(#666, #999);
	}

	.github {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.5rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.4rem;
		color: inherit;
		font-size: 0.85rem;
		text-decoration: none;
	}

	.github:hover {
		border-color: light-dark(#3b6ef5, #6d94ff);
	}

	h1 {
		margin-bottom: 0.25rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.presets {
		display: flex;
		gap: 0.25rem;
	}

	.presets button {
		padding: 0.3rem 0.7rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.4rem;
		background: light-dark(#fff, #222);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		text-transform: capitalize;
		cursor: pointer;
	}

	.presets button.active {
		border-color: light-dark(#3b6ef5, #6d94ff);
		background: light-dark(#eaf0ff, #1e2b4d);
	}

	.link {
		border: 0;
		background: none;
		color: light-dark(#3b6ef5, #6d94ff);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 17rem;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 48rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	aside {
		padding: 0.9rem;
		border: 1px solid light-dark(#e6e6e6, #333);
		border-radius: 0.5rem;
		background: light-dark(#fbfbfb, #1a1a1a);
	}

	.aside-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.aside-head h2 {
		margin: 0;
		font-size: 0.95rem;
	}

	.svgo {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid light-dark(#eee, #333);
		font-size: 0.85rem;
	}

	.link:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.progress {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: light-dark(#777, #999);
		font-variant-numeric: tabular-nums;
	}

	.warn {
		font-size: 0.85rem;
		color: light-dark(#a15c00, #e0a458);
	}

	.error {
		padding: 0.6rem 0.8rem;
		border-radius: 0.4rem;
		background: light-dark(#fdecec, #331a1a);
		color: light-dark(#b32020, #ff8a8a);
	}

	footer {
		margin-top: 3rem;
		font-size: 0.8rem;
		color: light-dark(#888, #888);
	}
</style>
