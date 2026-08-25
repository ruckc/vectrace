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
