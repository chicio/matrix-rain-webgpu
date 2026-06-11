# matrix-rain-webgpu

[![Deploy demo](https://github.com/chicio/matrix-rain-webgpu/actions/workflows/deploy.yml/badge.svg)](https://github.com/chicio/matrix-rain-webgpu/actions/workflows/deploy.yml)

> WebGPU + TypeGPU implementation of the Matrix-style falling-code rain. Sub-pixel-anti-aliased glyphs from a runtime-baked SDF atlas; GPU-driven simulation.

**▶ Live demo: https://chicio.github.io/matrix-rain-webgpu/** — auto-deployed from `main` on every push. Requires a WebGPU-capable browser (recent Chrome / Edge / Safari).

**Status: in active development.** Pre-v1; API not yet stable. Full consumer-facing README lands at the npm publish in milestone 10.

---

## What works today (through M7 / tag `0.7.0`)

- Falling kana with bright head + fading trail; every cell shows a unique glyph.
- 48-character atlas (Japanese half-width kana + digits + punctuation), runtime-baked as a signed distance field.
- Smooth head-to-tail brightness gradient with per-cell organic variation (film-faithful hybrid).
- **Parallax depth (M5):** per-column fall speed maps to a depth cue — far columns are dimmer and edge-softer; tail length varies per column.
- **Bloom (M6):** HDR render target → bright-pass extract → separable Gaussian blur (ping-pong) → additive combine, toggleable with threshold + intensity controls.
- **CRT (M7):** final post-process pass — chromatic aberration + scanlines + clamp tone-map. See [`docs/crt-pass.md`](docs/crt-pass.md) for the full math walkthrough.
- Live debug panel:
  - **Simulation:** density, stepRate, fontSize sliders + regenerate-seeds button
  - **Parallax:** speed min/max, tail min/max, depth-dimming sliders
  - **Bloom:** toggle + intensity + threshold sliders
  - **CRT:** toggle + scanlineStrength + aberration sliders
  - **Atlas debug:** scrub through all 48 glyphs to verify the bake
  - **Render mode:** the rain (`matrix-rain`, fully tuned via the panel) plus the `atlas-debug` raw-SDF view
  - **Observability:** FPS, canvas size + DPR, live column count, in-page error console

## What's planned

| Milestone | Adds | Status |
|---|---|---|
| M5 | Parallax (per-column speed + depth) + variable tail length | ✅ done (`0.5.0`) |
| M6 | Bloom post-process (HDR target + separable blur + additive combine) | ✅ done (`0.6.0`) |
| M7 | CRT pass (scanlines + chromatic aberration + tone-map) | ✅ done (`0.7.0`) |
| ~~M8~~ | ~~Mouse + scroll interaction~~ | ✂︎ cut — distracting for a background effect ([why](docs/superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md)) |
| M9 | `paused` static frame, lifecycle hardening, public component API | next up |
| M10 | npm publish + full consumer documentation | |

---

## Architecture

For maintainers and future-self:

- [`docs/DESIGN.md`](docs/DESIGN.md) — architecture overview, conventions, per-milestone trajectory
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — terminology reference
- [`docs/superpowers/specs/`](docs/superpowers/) — pre-implementation design rationale
- [`docs/superpowers/plans/`](docs/superpowers/) — milestone checkboxes + commit log

---

## Local development

```sh
npm install
npm run dev       # vite dev server with HMR
npm run types     # tsc -b
npm run check     # oxlint + oxfmt --check
npm run fix       # oxlint --fix + oxfmt
npm run build     # tsc -b && vite build (production demo)
npm run preview   # serve the production build locally
```

## CI / deploy

`.github/workflows/deploy.yml` runs on every push and PR:

- **`build`** — quality gate: `npm run types` + `npm run check` + `vite build`.
- **`deploy`** — on `main` only, publishes the built demo to GitHub Pages.

## License

TBD — finalized at M10 publish.
