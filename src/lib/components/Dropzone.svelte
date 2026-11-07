<script lang="ts">
	import { FileUpload } from '@ruckc/truss-ui';

	interface Props {
		onfile: (file: File) => void;
		disabled?: boolean;
	}

	let { onfile, disabled = false }: Props = $props();
</script>

<FileUpload
	multiple={false}
	list={false}
	paste="document"
	{disabled}
	label="Choose an image, drop one here, or paste from the clipboard"
	prompt="Drop an image here, click to choose, or paste from the clipboard"
	accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
	hint="PNG, JPG, WebP, GIF, AVIF — nothing is uploaded"
	onfiles={([file]) => file && onfile(file)}
/>
