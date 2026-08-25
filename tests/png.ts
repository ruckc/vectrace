/**
 * A minimal PNG encoder, so tests can build fixture images without a native dependency.
 * Truecolour + alpha, 8 bits per channel, no interlacing.
 */

import { deflateSync } from 'node:zlib';

function crc32(buf: Buffer): number {
	let c = ~0;
	for (const byte of buf) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
	return Buffer.concat([head, data, crc]);
}

/** `rgba` must be `width * height * 4` bytes. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
	// Each scanline is prefixed with its filter type; 0 = none.
	const raw = Buffer.alloc(height * (1 + width * 4));
	for (let y = 0; y < height; y++) {
		const at = y * (1 + width * 4);
		raw[at] = 0;
		Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)).copy(raw, at + 1);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: truecolour with alpha

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** Flat-colour shapes on white — the case vectorization should nail exactly. */
export function flatArtPng(size = 160): Buffer {
	const rgba = new Uint8Array(size * size * 4);
	const c = size / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let rgb: [number, number, number] = [255, 255, 255];
			if ((x - c * 0.6) ** 2 + (y - c * 0.6) ** 2 < (size * 0.22) ** 2) rgb = [220, 30, 30];
			if (x > size * 0.55 && x < size * 0.9 && y > size * 0.55 && y < size * 0.9)
				rgb = [30, 60, 220];
			const i = (y * size + x) * 4;
			[rgba[i], rgba[i + 1], rgba[i + 2]] = rgb;
			rgba[i + 3] = 255;
		}
	}
	return encodePng(size, size, rgba);
}

/**
 * A logo whose mark and ground both carry a subtle gradient, and whose colours contrast
 * in hue while sitting at nearly the same brightness. Tracing this by brightness alone
 * loses the mark; it is the regression fixture for colour-aware separation.
 */
export function gradientLogoPng(size = 160): Buffer {
	const rgba = new Uint8Array(size * size * 4);
	const lerp = (a: number[], b: number[], t: number) =>
		a.map((v, i) => Math.round(v + (b[i] - v) * t));

	// Ground: warm red. Mark: cool blue. Luma ≈ 106→133 vs 85→115 — barely separable.
	const ground: [number[], number[]] = [
		[220, 60, 40],
		[240, 90, 70]
	];
	const mark: [number[], number[]] = [
		[30, 90, 200],
		[60, 120, 230]
	];

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const t = y / (size - 1);
			const d = Math.hypot(x - size * 0.5, y - size * 0.44);
			const isMark =
				(d < size * 0.325 && d > size * 0.2125) ||
				(x > size * 0.25 && x < size * 0.75 && y > size * 0.775 && y < size * 0.875);
			const c = isMark ? lerp(mark[0], mark[1], t) : lerp(ground[0], ground[1], t);
			const i = (y * size + x) * 4;
			[rgba[i], rgba[i + 1], rgba[i + 2]] = c;
			rgba[i + 3] = 255;
		}
	}
	return encodePng(size, size, rgba);
}

/** A white mark on a fully transparent ground — the case a white matte would erase. */
export function transparentLogoPng(size = 160): Buffer {
	const rgba = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const d = Math.hypot(x - size / 2, y - size / 2);
			const isMark = d < size * 0.34 && d > size * 0.2;
			const i = (y * size + x) * 4;
			// Near-white mark; the ground keeps the transparent-black RGB a canvas gives it.
			rgba[i] = rgba[i + 1] = rgba[i + 2] = isMark ? 250 : 0;
			rgba[i + 3] = isMark ? 255 : 0;
		}
	}
	return encodePng(size, size, rgba);
}
