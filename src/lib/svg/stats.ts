/** Cheap structural measurements of an SVG string, for the stats readout. */

export interface SvgStats {
	bytes: number;
	paths: number;
	/** Total path commands across every `d` attribute — a proxy for geometric complexity. */
	nodes: number;
}

const PATH_RE = /<path\b/g;
const D_RE = /\sd="([^"]*)"/g;
const COMMAND_RE = /[MmLlHhVvCcSsQqTtAaZz]/g;

export function svgStats(svg: string): SvgStats {
	let nodes = 0;
	for (const m of svg.matchAll(D_RE)) {
		nodes += m[1].match(COMMAND_RE)?.length ?? 0;
	}

	return {
		bytes: new TextEncoder().encode(svg).length,
		paths: svg.match(PATH_RE)?.length ?? 0,
		nodes
	};
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
