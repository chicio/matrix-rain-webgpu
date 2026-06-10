# matrix-rain-webgpu

> WebGPU + TypeGPU implementation of the Matrix-style falling-code rain. Sub-pixel-anti-aliased glyphs from a runtime-baked SDF atlas; GPU-driven simulation.

**Status: in active development.** Pre-v1; API not yet stable. Full consumer-facing README lands at the npm publish in milestone 10.

---

## What works today (through M4 / tag `0.4.0`)

- Falling kana with bright head + fading trail; every cell shows a unique glyph.
- 48-character atlas (Japanese half-width kana + digits + punctuation), runtime-baked as a signed distance field.
- Smooth head-to-tail brightness gradient with per-cell organic variation (film-faithful hybrid).
- Live debug panel:
  - **Simulation:** density, stepRate, fontSize sliders + regenerate-seeds button
  - **Atlas debug:** scrub through all 48 glyphs to verify the bake
  - **Render mode:** switch between `state-debug`, `atlas-debug`, and various placeholders (M5+ will unlock the rest)
  - **Observability:** FPS, canvas size + DPR, live column count, in-page error console

## What's planned

| Milestone | Adds | Status |
|---|---|---|
| M5 | Parallax (per-column speed + depth) + variable tail length | next up |
| M6 | Bloom post-process (HDR target + separable blur + additive combine) | |
| M7 | CRT pass (scanlines + chromatic aberration + tone-map) | |
| M8 | Mouse + scroll interaction | |
| M9 | `paused` static frame, lifecycle hardening, public component API | |
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
pnpm install
pnpm dev          # vite dev server with HMR
pnpm types        # tsc -b
pnpm check        # oxlint + oxfmt --check
pnpm fix          # oxlint --fix + oxfmt
```

## License

TBD — finalized at M10 publish.
