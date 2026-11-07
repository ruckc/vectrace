<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		Button,
		Callout,
		Cluster,
		Container,
		Footer,
		Heading,
		Link,
		Navbar,
		Panel,
		ProgressBar,
		SegmentedControl,
		Stack,
		Switch,
		Text
	} from '@ruckc/truss-ui';
	import CompareView from '$lib/components/CompareView.svelte';
	import Dropzone from '$lib/components/Dropzone.svelte';
	import ExportBar from '$lib/components/ExportBar.svelte';
	import ParamPanel from '$lib/components/ParamPanel.svelte';
	import StatsBar from '$lib/components/StatsBar.svelte';
	import { groupsFor } from '$lib/engines/params';
	import { ENGINES, PRESETS, type EngineId, type PresetName } from '$lib/engines/types';
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
		content="Free image to SVG converter that runs entirely in your browser. Convert PNG, JPG, WebP and GIF to SVG with live tuning — nothing is uploaded, no account, no subscription."
	/>
	<link rel="canonical" href="https://vectrace.ruck.io/" />
	<meta name="theme-color" content="#1e293b" />

	<meta property="og:site_name" content="vectrace" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://vectrace.ruck.io/" />
	<meta property="og:title" content="vectrace — image to SVG, in your browser" />
	<meta
		property="og:description"
		content="Convert PNG, JPG, WebP and GIF images to SVG entirely in your browser. Nothing is uploaded."
	/>
	<meta property="og:image" content="https://vectrace.ruck.io/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="vectrace logo and tagline: convert images to SVG entirely in your browser"
	/>

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="vectrace — image to SVG, in your browser" />
	<meta
		name="twitter:description"
		content="Convert PNG, JPG, WebP and GIF images to SVG entirely in your browser. Nothing is uploaded."
	/>
	<meta name="twitter:image" content="https://vectrace.ruck.io/og.png" />
</svelte:head>

<Navbar contained brandHref="/">
	{#snippet brand()}vectrace{/snippet}
	{#snippet end()}
		<Button
			variant="minimal"
			icon="github"
			href="https://github.com/ruckc/vectrace"
			aria-label="vectrace on GitHub">GitHub</Button
		>
	{/snippet}
</Navbar>

<Container as="main">
	<Stack gap={5} style="padding-block: var(--tr-space-6)">
		<Stack gap={1}>
			<Heading level={1} size="2xl">vectrace</Heading>
			<Text tone="muted">Raster images to SVG, entirely in your browser. Nothing is uploaded.</Text>
		</Stack>

		{#if !trace.sourceUrl}
			<Dropzone onfile={(f) => trace.open(f)} disabled={trace.busy} />
		{:else}
			<Cluster gap={3} justify="between">
				<Cluster gap={3}>
					<SegmentedControl
						label="Engine"
						size="sm"
						options={ENGINES.map((e) => ({ value: e.id, label: e.label }))}
						bind:value={() => trace.engine, (v) => trace.selectEngine(v as EngineId)}
					/>
					{#if trace.supportsPresets}
						<SegmentedControl
							label="Preset"
							size="sm"
							options={PRESETS.map((p) => ({ value: p, label: p }))}
							bind:value={() => trace.preset, (v) => trace.selectPreset(v as PresetName)}
						/>
					{/if}
				</Cluster>
				<Button variant="minimal" size="sm" icon="refresh" onclick={() => trace.reset()}>
					Use a different image
				</Button>
			</Cluster>

			<div class="layout">
				<Stack gap={4}>
					<CompareView
						sourceUrl={trace.sourceUrl}
						svg={trace.svg}
						width={trace.sourceWidth}
						height={trace.sourceHeight}
					/>

					{#if trace.progress}
						<ProgressBar
							value={trace.progress.fraction * 100}
							size="sm"
							label={trace.progress.phase}
							showValue
						/>
					{:else if trace.busy}
						<Text tone="muted" size="sm">Tracing…</Text>
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
						<Callout intent="warning">
							Source was {trace.downscaledFrom.width} × {trace.downscaledFrom.height} and was scaled down
							to {trace.sourceWidth} × {trace.sourceHeight} before tracing.
						</Callout>
					{/if}

					<ExportBar
						getSvg={() => trace.renderFull()}
						filename={trace.sourceName ?? 'image'}
						disabled={!trace.svg}
					/>
				</Stack>

				{#if trace.params}
					<aside>
						<Panel title="Parameters">
							{#snippet actions()}
								<Button
									variant="minimal"
									size="sm"
									disabled={trace.isPristine}
									onclick={() => trace.resetParams()}>Reset</Button
								>
							{/snippet}
							<Stack gap={4}>
								<ParamPanel
									bind:params={trace.params}
									groups={groupsFor(trace.engine)}
									onchange={() => trace.paramsChanged()}
								/>
								<Switch bind:checked={() => trace.svgo, (v) => trace.setSvgo(v)}>
									Optimize with SVGO
								</Switch>
							</Stack>
						</Panel>
					</aside>
				{/if}
			</div>
		{/if}

		{#if trace.error}
			<Callout intent="danger" title="Something went wrong">{trace.error}</Callout>
		{/if}
	</Stack>
</Container>

<Footer variant="bordered" contained>
	<Text size="sm" tone="muted">
		<Link href="https://github.com/visioncortex/vtracer">VTracer</Link> and
		<Link href="https://potrace.sourceforge.net/">Potrace</Link>, compiled to WebAssembly and run in
		your browser. GPL-2.0-or-later —
		<Link href="https://github.com/ruckc/vectrace">source</Link>.
	</Text>
</Footer>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--tr-space-6);
		align-items: start;
	}

	@media (max-width: 48rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
