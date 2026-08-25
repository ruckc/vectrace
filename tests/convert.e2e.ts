import { expect, test } from '@playwright/test';
import { flatArtPng } from './png';

const FIXTURE = { name: 'flat-art.png', mimeType: 'image/png', buffer: flatArtPng() };

test('traces a dropped image to SVG and offers it for download', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'vectrace' })).toBeVisible();

	await page.setInputFiles('input[type=file]', FIXTURE);

	// The SVG is rendered as a data: URL, so its presence is the signal that tracing ran.
	const output = page.getByAltText('Traced vector output');
	await expect(output).toBeVisible({ timeout: 20_000 });
	await expect(output).toHaveAttribute('src', /^data:image\/svg\+xml/);

	await expect(page.getByText('160 × 160')).toBeVisible();

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /Download flat-art\.svg/ }).click();
	const saved = await download;
	expect(saved.suggestedFilename()).toBe('flat-art.svg');

	const stream = await saved.createReadStream();
	const svg = (await stream.toArray()).join('');
	expect(svg).toContain('<svg');
	expect(svg).toContain('<path');
	// Background plus the two shapes, at minimum.
	expect(svg.match(/<path/g)!.length).toBeGreaterThanOrEqual(3);
});

test('switching preset re-traces', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	const before = await page.getByAltText('Traced vector output').getAttribute('src');
	await page.getByRole('button', { name: 'bw', exact: true }).click();

	await expect
		.poll(() => page.getByAltText('Traced vector output').getAttribute('src'), {
			timeout: 20_000
		})
		.not.toBe(before);
});

test('tuning a parameter re-traces and is captured in the URL', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	const before = await page.getByAltText('Traced vector output').getAttribute('src');

	// Straight edges instead of curves: the path data must change.
	await page.locator('#p-mode').selectOption('polygon');
	await expect
		.poll(() => page.getByAltText('Traced vector output').getAttribute('src'), { timeout: 20_000 })
		.not.toBe(before);

	// Slider edits reach the URL even when they leave the output untouched.
	const speckle = page.locator('#p-filterSpeckle');
	await speckle.fill('20');
	await speckle.dispatchEvent('input');
	await expect.poll(() => page.evaluate(() => location.hash)).toContain('filterSpeckle=20');
	await expect.poll(() => page.evaluate(() => location.hash)).toContain('mode=polygon');
});

test('a shared link restores the tuning', async ({ page }) => {
	await page.goto('/#mode=polygon&filterSpeckle=20');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	await expect(page.locator('#p-filterSpeckle')).toHaveValue('20');
	await expect(page.locator('#p-mode')).toHaveValue('polygon');
});

test('binary clustering swaps in the threshold controls', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	// Colour clustering shows colour precision, not a threshold.
	await expect(page.locator('#p-colorPrecision')).toBeVisible();
	await expect(page.locator('#p-binaryThreshold')).toHaveCount(0);

	await page.locator('#p-clustering').selectOption('binary');
	await expect(page.locator('#p-binaryThreshold')).toBeVisible();
	await expect(page.locator('#p-colorPrecision')).toHaveCount(0);

	// Turning on adaptive thresholding replaces the fixed cutoff.
	await page.locator('#p-binaryAdaptive').check();
	await expect(page.locator('#p-binaryThreshold')).toHaveCount(0);
	await expect(page.locator('#p-binaryAdaptiveT')).toBeVisible();
});

test('the SVGO pass shrinks the output and can be turned off', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	// On by default, and it should report a saving on real trace output.
	const saving = page.locator('.saved');
	await expect(saving).toBeVisible({ timeout: 20_000 });
	await expect(saving).toHaveText(/−\d+%/);

	const optimizedSrc = await page.getByAltText('Traced vector output').getAttribute('src');

	await page.getByLabel('Optimize with SVGO').uncheck();
	await expect(saving).toHaveCount(0, { timeout: 20_000 });

	const rawSrc = await page.getByAltText('Traced vector output').getAttribute('src');
	expect(rawSrc!.length).toBeGreaterThan(optimizedSrc!.length);
});

test('the potrace engine produces its own output and controls', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	const vtracerSrc = await page.getByAltText('Traced vector output').getAttribute('src');
	await expect(page.locator('#p-clustering')).toBeVisible();

	await page.getByRole('button', { name: 'Potrace' }).click();

	// vtracer's controls give way to potrace's.
	await expect(page.locator('#p-turdsize')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('#p-clustering')).toHaveCount(0);
	// Presets belong to vtracer only.
	await expect(page.getByRole('group', { name: 'Preset' })).toHaveCount(0);

	await expect
		.poll(() => page.getByAltText('Traced vector output').getAttribute('src'), { timeout: 30_000 })
		.not.toBe(vtracerSrc);

	await expect.poll(() => page.evaluate(() => location.hash)).toContain('e=potrace');

	// And it still exports.
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /Download flat-art\.svg/ }).click();
	const stream = await (await download).createReadStream();
	expect((await stream.toArray()).join('')).toContain('<path');
});

test('flat art round-trips back to nearly the same pixels', async ({ page }) => {
	await page.goto('/');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await expect(page.getByAltText('Traced vector output')).toBeVisible({ timeout: 20_000 });

	// Rasterize the traced SVG and the original at the same size, then compare. Flat art
	// is the case vectorization should get essentially exact, so this is a tight bound
	// that will fail loudly if a parameter default or the SVG writer regresses.
	const mismatch = await page.evaluate(async () => {
		const draw = async (src: string) => {
			const img = new Image();
			img.decode ??= () => Promise.resolve();
			await new Promise((res, rej) => {
				img.onload = res;
				img.onerror = rej;
				img.src = src;
			});
			const c = new OffscreenCanvas(160, 160);
			const ctx = c.getContext('2d')!;
			ctx.drawImage(img, 0, 0, 160, 160);
			return ctx.getImageData(0, 0, 160, 160).data;
		};

		const imgs = [...document.querySelectorAll('img')] as HTMLImageElement[];
		const original = imgs.find((i) => i.alt === 'Original, before tracing')!;
		const traced = imgs.find((i) => i.alt === 'Traced vector output')!;

		const [a, b] = [await draw(original.src), await draw(traced.src)];

		let differing = 0;
		for (let i = 0; i < a.length; i += 4) {
			// Per-channel tolerance absorbs antialiasing along the traced edges.
			const delta =
				Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
			if (delta > 90) differing++;
		}
		return differing / (a.length / 4);
	});

	expect(mismatch).toBeLessThan(0.02);
});
