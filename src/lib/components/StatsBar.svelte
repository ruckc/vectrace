<script lang="ts">
	import { DescriptionList, Tag, Tooltip } from '@ruckc/truss-ui';
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

<DescriptionList layout="inline">
	<dt>Size</dt>
	<dd>{sourceWidth} × {sourceHeight}</dd>
	<dt>Shapes</dt>
	<dd>{shapeCount.toLocaleString()}</dd>
	{#if stats}
		<dt>Nodes</dt>
		<dd>{stats.nodes.toLocaleString()}</dd>
		<dt>SVG</dt>
		<dd>
			{formatBytes(stats.bytes)}
			{#if saved > 0}
				<Tooltip text="SVGO removed {formatBytes(optimized!.beforeBytes - optimized!.afterBytes)}">
					<Tag intent="success" size="sm">−{(saved * 100).toFixed(0)}%</Tag>
				</Tooltip>
			{/if}
		</dd>
	{/if}
	<dt>Time</dt>
	<dd>{ms.toFixed(0)} ms</dd>
	{#if isPreview}
		<dt>Quality</dt>
		<dd>
			<Tooltip text="Traced from a downscaled copy for responsiveness">
				<Tag intent="warning" size="sm">preview</Tag>
			</Tooltip>
		</dd>
	{/if}
</DescriptionList>
