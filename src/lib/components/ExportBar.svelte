<script lang="ts">
	import { Button, Callout, Cluster } from '@ruckc/truss-ui';

	interface Props {
		/** Produces the full-resolution SVG. May trigger a re-trace, so it is async. */
		getSvg: () => Promise<string>;
		filename: string;
		disabled?: boolean;
	}

	let { getSvg, filename, disabled = false }: Props = $props();

	let working = $state(false);
	let copied = $state(false);
	let failed = $state<string | null>(null);

	const outputName = $derived(filename.replace(/\.[^.]+$/, '') + '.svg');

	async function withSvg(fn: (svg: string) => void | Promise<void>) {
		working = true;
		failed = null;
		try {
			await fn(await getSvg());
		} catch (e) {
			failed = e instanceof Error ? e.message : String(e);
		} finally {
			working = false;
		}
	}

	const download = () =>
		withSvg((svg) => {
			const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
			const a = document.createElement('a');
			a.href = url;
			a.download = outputName;
			a.click();
			URL.revokeObjectURL(url);
		});

	const copy = () =>
		withSvg(async (svg) => {
			await navigator.clipboard.writeText(svg);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		});
</script>

<Cluster gap={2}>
	<Button icon="download" loading={working} disabled={disabled || working} onclick={download}>
		{working ? 'Tracing at full size…' : `Download ${outputName}`}
	</Button>
	<Button variant="outlined" icon="copy" disabled={disabled || working} onclick={copy}>
		{copied ? 'Copied' : 'Copy SVG'}
	</Button>
</Cluster>
{#if failed}<Callout intent="danger">{failed}</Callout>{/if}
