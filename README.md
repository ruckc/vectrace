# vectrace

Convert raster images (PNG, JPG, WebP, GIF, AVIF) to SVG **entirely in your browser**.
No server, no upload, no account — the image never leaves your machine.

Drop an image, tune the parameters live, download the SVG. Settings are captured in the
URL, so a link carries your tuning with it.

## Engines

| Engine                | Good at                                                         | License          |
| --------------------- | --------------------------------------------------------------- | ---------------- |
| **VTracer** (default) | Colour vectorization; logos, illustrations, screenshots, photos | MIT              |
| **Potrace**           | Black-and-white line art                                        | GPL-2.0-or-later |

VTracer is [visioncortex/vtracer](https://github.com/visioncortex/vtracer) `1.0.0-alpha.3`,
compiled to WebAssembly from `crates/vectrace-wasm`. Its `Session` API caches the expensive
clustering step, so dragging a slider only re-runs the cheap stages.

Potrace comes from [`esm-potrace-wasm`](https://github.com/tomayac/esm-potrace-wasm) and is
loaded lazily, only once you select it.

Output optionally goes through [SVGO](https://github.com/svg/svgo) — on by default, with
the saving shown in the stats bar.

## Development

Tooling is managed by [mise](https://mise.jdx.dev/) (Node, Rust, wasm-pack):

```sh
mise install     # node + rust + wasm-pack
npm ci
mise run dev     # builds the wasm engine, then starts vite
```

| Command                      | What it does                                         |
| ---------------------------- | ---------------------------------------------------- |
| `mise run build:wasm`        | compile `crates/vectrace-wasm` into `src/lib/wasm/`  |
| `mise run build`             | wasm + static site into `build/`                     |
| `mise run flc`               | format, lint, svelte-check                           |
| `mise run clippy`            | lint the Rust crate against the wasm target          |
| `npm run test:unit -- --run` | vitest                                               |
| `npx playwright test`        | end-to-end tests, including a round-trip pixel check |

`src/lib/wasm/` is generated and gitignored, so a clean clone needs the Rust toolchain.
Vite emits the `.wasm` as a hashed asset, which is what keeps it resolvable under the
GitHub Pages base path.

### Layout

```
crates/vectrace-wasm/   Rust → wasm wrapper around vtracer (the only Rust here)
src/lib/engines/        engine contracts, parameter schema, potrace
src/lib/trace/          the worker, its message protocol, and the main-thread client
src/lib/svg/            SVGO pass and output stats
src/lib/state/          runes state and the URL codec
tests/                  Playwright specs and a dependency-free PNG encoder for fixtures
```

## Known limitations

- **A running trace cannot be cancelled.** GitHub Pages cannot send COOP/COEP headers, so
  there is no `SharedArrayBuffer`, and a worker blocked inside wasm cannot see an incoming
  message. Instead the UI keeps at most one render in flight and previews from a downscaled
  copy (≤800px) while you tune; the download always re-traces at full resolution.
- **Single-threaded wasm**, for the same reason.
- Images above 4000px on the long edge are downscaled before tracing, with a notice.
- `vite build` prints a `node:fs has been externalized` warning from `esm-potrace-wasm`.
  It is an Emscripten bundle with a Node branch that never runs in the browser; harmless.

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml`.
The site is served as a project page, so the build sets `BASE_PATH=/<repo-name>` and
SvelteKit emits relative asset URLs.

Repository settings → Pages → Source must be set to **GitHub Actions**.

## License

Copyright (C) 2026 Curtis Ruck

This program is free software; you can redistribute it and/or modify it under the terms of
the GNU General Public License as published by the Free Software Foundation; either
version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the [GNU General Public License](LICENSE) for more details.

The GPL requirement comes from potrace; everything else in the stack is MIT or Apache-2.0.
See [NOTICE](NOTICE) for the full third-party breakdown and for what it would take to
relicense under MIT.
