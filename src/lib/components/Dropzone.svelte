<script lang="ts">
	interface Props {
		onfile: (file: File) => void;
		disabled?: boolean;
	}

	let { onfile, disabled = false }: Props = $props();

	let over = $state(false);
	let input: HTMLInputElement;

	const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp';

	function take(files: FileList | null | undefined) {
		const file = files?.[0];
		if (file && file.type.startsWith('image/')) onfile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		over = false;
		if (!disabled) take(e.dataTransfer?.files);
	}

	// Paste anywhere on the page, not just when the dropzone has focus.
	function onPaste(e: ClipboardEvent) {
		if (disabled) return;
		const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
		const file = item?.getAsFile();
		if (file) onfile(file);
	}
</script>

<svelte:window onpaste={onPaste} />

<div
	class="zone"
	class:over
	class:disabled
	role="button"
	tabindex="0"
	ondragover={(e) => {
		e.preventDefault();
		over = true;
	}}
	ondragleave={() => (over = false)}
	ondrop={onDrop}
	onclick={() => !disabled && input.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			input.click();
		}
	}}
>
	<input
		bind:this={input}
		type="file"
		accept={ACCEPT}
		hidden
		onchange={(e) => take(e.currentTarget.files)}
	/>
	<strong>Drop an image here</strong>
	<span>or click to choose, or paste from the clipboard</span>
	<small>PNG, JPG, WebP, GIF, AVIF — nothing is uploaded</small>
</div>

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 3rem 1.5rem;
		border: 2px dashed light-dark(#c4c4c4, #4a4a4a);
		border-radius: 0.75rem;
		background: light-dark(#fafafa, #1c1c1c);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 120ms,
			background 120ms;
	}

	.zone:hover:not(.disabled),
	.zone:focus-visible,
	.over {
		border-color: light-dark(#3b6ef5, #6d94ff);
		background: light-dark(#f2f6ff, #1a2233);
	}

	.disabled {
		cursor: progress;
		opacity: 0.6;
	}

	small {
		color: light-dark(#777, #999);
	}
</style>
