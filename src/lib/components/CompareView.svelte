<script lang="ts">
	import { ImageCompare } from '@ruckc/truss-ui';

	interface Props {
		sourceUrl: string;
		svg: string | null;
		width: number;
		height: number;
	}

	let { sourceUrl, svg, width, height }: Props = $props();

	// Rendering the SVG as a data URL rather than injecting the markup keeps untrusted
	// path data out of the DOM and stops its styles leaking into the page.
	const svgUrl = $derived(svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null);
</script>

<ImageCompare
	before={sourceUrl}
	after={svgUrl ?? sourceUrl}
	beforeLabel="Original"
	afterLabel="SVG"
	label="Compare original against SVG"
	ratio={width && height ? width / height : 1}
	checkerboard
	toolbar
	style="max-height: 70vh"
/>
