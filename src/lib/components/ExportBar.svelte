<script lang="ts">
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

<div class="bar">
	<button class="primary" onclick={download} disabled={disabled || working}>
		{working ? 'Tracing at full size…' : `Download ${outputName}`}
	</button>
	<button onclick={copy} disabled={disabled || working}>
		{copied ? 'Copied' : 'Copy SVG'}
	</button>
	{#if failed}<span class="error">{failed}</span>{/if}
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	button {
		padding: 0.5rem 0.9rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.4rem;
		background: light-dark(#fff, #222);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.primary {
		border-color: light-dark(#3b6ef5, #6d94ff);
		background: light-dark(#3b6ef5, #3559b5);
		color: #fff;
	}

	.error {
		color: light-dark(#b32020, #ff8a8a);
		font-size: 0.85rem;
	}
</style>
