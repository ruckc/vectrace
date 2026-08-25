<script lang="ts">
	import type { SvgStats } from '$lib/svg/stats';
	import { formatBytes } from '$lib/svg/stats';

	interface Props {
		stats: SvgStats | null;
		shapeCount: number;
		ms: number;
		isPreview: boolean;
		sourceWidth: number;
		sourceHeight: number;
		optimized: { beforeBytes: number; afterBytes: number } | null;
	}

	let { stats, shapeCount, ms, isPreview, sourceWidth, sourceHeight, optimized }: Props = $props();

	const saved = $derived(
		optimized && optimized.beforeBytes > optimized.afterBytes
			? 1 - optimized.afterBytes / optimized.beforeBytes
			: 0
	);
</script>

<dl>
	<div>
		<dt>Size</dt>
		<dd>{sourceWidth} × {sourceHeight}</dd>
	</div>
	<div>
		<dt>Shapes</dt>
		<dd>{shapeCount.toLocaleString()}</dd>
	</div>
	{#if stats}
		<div>
			<dt>Nodes</dt>
			<dd>{stats.nodes.toLocaleString()}</dd>
		</div>
		<div>
			<dt>SVG</dt>
			<dd>
				{formatBytes(stats.bytes)}
				{#if saved > 0}
					<span
						class="saved"
						title="SVGO removed {formatBytes(optimized!.beforeBytes - optimized!.afterBytes)}"
					>
						−{(saved * 100).toFixed(0)}%
					</span>
				{/if}
			</dd>
		</div>
	{/if}
	<div>
		<dt>Time</dt>
		<dd>{ms.toFixed(0)} ms</dd>
	</div>
	{#if isPreview}
		<div class="note" title="Traced from a downscaled copy for responsiveness">
			<dt>Quality</dt>
			<dd>preview</dd>
		</div>
	{/if}
</dl>

<style>
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
	}

	div {
		display: flex;
		gap: 0.4rem;
	}

	dt {
		color: light-dark(#777, #999);
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.saved {
		color: light-dark(#1a7f37, #4ac26b);
	}

	.note dd {
		color: light-dark(#a15c00, #e0a458);
	}
</style>
