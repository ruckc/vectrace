import { describe, expect, it } from 'vitest';
import { formatBytes, svgStats } from './stats';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">
<path d="M0,0L8,0L8,8Z" fill="#fff"/>
<path d="M1,1c1,1 2,2 3,3z" fill="#000"/>
</svg>`;

describe('svgStats', () => {
	it('counts paths and path commands', () => {
		const s = svgStats(SVG);
		expect(s.paths).toBe(2);
		// M L L Z + M c z
		expect(s.nodes).toBe(7);
	});

	it('measures bytes as UTF-8, not code units', () => {
		// 5 + 2 (é is two bytes) + 6
		expect(svgStats('<svg>é</svg>').bytes).toBe(13);
	});

	it('handles an SVG with no paths', () => {
		expect(svgStats('<svg><rect/></svg>')).toMatchObject({ paths: 0, nodes: 0 });
	});
});

describe('formatBytes', () => {
	it('scales the unit', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 kB');
		expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
	});
});
