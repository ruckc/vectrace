<script lang="ts">
	interface Props {
		sourceUrl: string;
		svg: string | null;
		width: number;
		height: number;
	}

	let { sourceUrl, svg, width, height }: Props = $props();

	type Mode = 'split' | 'side' | 'svg' | 'source';
	let mode = $state<Mode>('split');
	/** Split position, 0-100. */
	let split = $state(50);

	// Rendering the SVG as a data URL rather than injecting the markup keeps untrusted
	// path data out of the DOM and stops its styles leaking into the page.
	const svgUrl = $derived(svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null);
	const ratio = $derived(width && height ? `${width} / ${height}` : '1 / 1');
</script>

<div class="toolbar" role="group" aria-label="Comparison mode">
	{#each [['split', 'Split'], ['side', 'Side by side'], ['svg', 'SVG'], ['source', 'Original']] as const as [value, label] (value)}
		<button class:active={mode === value} onclick={() => (mode = value)}>{label}</button>
	{/each}
</div>

{#if mode === 'side'}
	<div class="side">
		<figure>
			<img src={sourceUrl} alt="Original, before tracing" />
			<figcaption>Original</figcaption>
		</figure>
		<figure>
			{#if svgUrl}<img src={svgUrl} alt="Traced vector output" />{/if}
			<figcaption>SVG</figcaption>
		</figure>
	</div>
{:else if mode === 'split'}
	<div class="split checker" style="aspect-ratio: {ratio}">
		<img src={sourceUrl} alt="Original, before tracing" />
		{#if svgUrl}
			<img
				class="overlay"
				src={svgUrl}
				alt="Traced vector output"
				style="clip-path: inset(0 0 0 {split}%)"
			/>
		{/if}
		<div class="handle" style="left: {split}%"></div>
		<input
			class="scrub"
			type="range"
			min="0"
			max="100"
			step="0.1"
			bind:value={split}
			aria-label="Compare original against SVG"
		/>
	</div>
{:else}
	<div class="single checker" style="aspect-ratio: {ratio}">
		{#if mode === 'svg' && svgUrl}
			<img src={svgUrl} alt="Traced vector output" />
		{:else}
			<img src={sourceUrl} alt="Original, before tracing" />
		{/if}
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.toolbar button {
		padding: 0.3rem 0.7rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.4rem;
		background: light-dark(#fff, #222);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.toolbar button.active {
		border-color: light-dark(#3b6ef5, #6d94ff);
		background: light-dark(#eaf0ff, #1e2b4d);
	}

	/* A checkerboard, so transparent regions of either image are obvious. */
	.checker {
		background-image:
			linear-gradient(45deg, light-dark(#eee, #2a2a2a) 25%, transparent 25%),
			linear-gradient(-45deg, light-dark(#eee, #2a2a2a) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, light-dark(#eee, #2a2a2a) 75%),
			linear-gradient(-45deg, transparent 75%, light-dark(#eee, #2a2a2a) 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
	}

	.split,
	.single {
		position: relative;
		width: 100%;
		max-height: 70vh;
		border: 1px solid light-dark(#e0e0e0, #333);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.split img,
	.single img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: light-dark(#3b6ef5, #6d94ff);
		pointer-events: none;
	}

	/* An invisible range input laid over the image gives keyboard and touch scrubbing for free. */
	.scrub {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
	}

	.side {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.side figure {
		margin: 0;
	}

	.side img {
		width: 100%;
		border: 1px solid light-dark(#e0e0e0, #333);
		border-radius: 0.5rem;
	}

	figcaption {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: light-dark(#777, #999);
	}
</style>
