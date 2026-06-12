# matrix-rain-webgpu — Architecture

Repo-internal design overview. Living document; updated at each milestone close.

For first-principles design rationale (why these choices were made at all), see [`docs/superpowers/specs/2026-06-07-matrix-rain-webgpu-design.md`](superpowers/specs/2026-06-07-matrix-rain-webgpu-design.md). For implementation roadmap and milestone checkboxes, see [`docs/superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md`](superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md). For terminology used here, see [`docs/GLOSSARY.md`](GLOSSARY.md).

---

## Overview

A React + TypeGPU + WebGPU implementation of the Matrix-style falling-code rain. Distinguishing characteristics vs the typical 2D canvas implementation:

- **Sub-pixel anti-aliased glyphs** at any rendering scale, from a single 64×64-per-glyph SDF atlas baked at runtime.
- **GPU-driven simulation** — column state lives in a storage buffer; a compute pass advances heads per logical step; nothing about column positions or seeds round-trips through CPU after init.
- **Spatially-anchored glyphs** — each cell's character is determined by a hash of `(column.seed, row)`. As a column falls, its visible characters stay fixed in place; the head appears to slide past them rather than scrolling them. Reset only when the column respawns.
- **Two-axis variation** — head-to-tail brightness gradient (deterministic curve) plus per-cell ±60% brightness jitter (decorrelated hash) gives the film's "deliberate gradient with organic variation" look.

Built as an npm package (target name `matrix-rain-webgpu`) plus a co-located demo harness. The demo (`src/demo/`) is the per-milestone verification surface and ships separately from the published library (`src/lib/`).

---

## Architecture at a glance

```
                                  ┌─────────────────────────────┐
                                  │   useMatrixRainRenderer     │
                                  │   (src/lib/hooks/)          │
                                  │                             │
                                  │   - bakes atlas once         │
                                  │   - lazy-constructs graph    │
                                  │   - tick(dt, t) entry point  │
                                  └────────────┬────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            createRenderGraph                                │
│                            (src/lib/gpu/render-graph.ts)                    │
│                                                                             │
│   Owns: Uniforms buffer  ·  Column[] storage buffer  ·  Atlas texture       │
│         Atlas sampler   ·  Bind groups   ·  All pipelines                   │
│                                                                             │
│   Lifecycle methods: resize, step, render, renderAtlasDebug, regenerate,    │
│                      setDensity, setStepRate, setAtlasLayer, dispose        │
└───────────────┬───────────────────────┬────────────────────┬────────────────┘
                │                       │                    │
                ▼                       ▼                    ▼
   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
   │ compute-step         │  │ render-glyphs        │  │ render-atlas-debug   │
   │ (advance heads,      │  │ (per-cell glyph      │  │ (one centered glyph; │
   │  respawn)            │  │  sampling, AA)       │  │  diagnostic)         │
   └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
                                       │                         │
                                       └─────────┬───────────────┘
                                                 ▼
                                       ┌──────────────────┐
                                       │  Atlas + sampler │
                                       │  (M3-baked SDF)  │
                                       └──────────────────┘
```

Per-frame data flow (in `state-debug` / `glyphs-flat` mode):

1. **CPU:** hook's `tick(dt, t)` reads canvas size, calls `resize()`, `step(dt, t)`, `render()`.
2. **Compute pass (in `step()`):** advances every column's `headY` by `column.speed`. Off-screen columns may respawn (gated by density).
3. **Render pass (in `render()`):** one full-screen triangle; fragment shader decomposes each pixel into `(col, row, localUv)`, decides if the cell is in-tail, samples the atlas at the row's glyph index, mixes background with `glyphColor × brightness` weighted by per-pixel coverage.

---

## Project structure

```
src/
├── lib/                                # the publishable package
│   ├── index.ts                        # public exports (currently isWebGPUSupported)
│   ├── feature-detect.ts               # isWebGPUSupported()
│   ├── gpu/
│   │   ├── schemas.ts                  # Column + Uniforms TypeGPU structs
│   │   ├── palette.ts                  # PALETTE = {background, head, trail, fade}
│   │   ├── hash.ts                     # glyphIndex, brightnessJitter
│   │   ├── render-graph.ts             # createRenderGraph factory
│   │   ├── atlas/
│   │   │   ├── glyph-set.ts            # GLYPHS, GLYPH_COUNT, ATLAS_LAYER_SIZE
│   │   │   ├── build-sdf-atlas.ts      # CPU-side SDF baker
│   │   │   └── bindings.ts             # atlasBindings (shared bind group layout)
│   │   └── pipelines/
│   │       ├── compute-step.ts         # advance heads + respawn
│   │       ├── render-glyphs.ts        # per-cell glyph sampling + AA
│   │       └── render-atlas-debug.ts   # centered single-glyph diagnostic
│   └── hooks/
│       └── use-matrix-rain-renderer.ts # wires render-graph into useFrame
└── demo/                               # development harness; NOT published
    ├── App.tsx
    ├── debug-panel/                    # Effects, Observability, RenderMode, etc.
    └── ...
```

The `pipelines/` files appear one-per-milestone (M2: compute-step + render-glyphs; M3: render-atlas-debug; M6-7 will add bloom + crt).

---

## Public API surface (current — pre-M9)

`createRenderGraph(args): RenderGraph`

Vanilla TS factory (no React) returning:

```ts
type RenderGraph = {
  resize: (width: number, height: number) => void;
  step: (deltaSeconds: number, elapsedSeconds: number) => void;
  render: () => void;
  renderAtlasDebug: () => void;
  setDensity: (density: number) => void;
  setStepRate: (stepRate: number) => void;
  setAtlasLayer: (layer: number) => void;
  regenerate: () => void;
  getColumnCount: () => number;
  dispose: () => void;
};
```

`useMatrixRainRenderer(args): MatrixRainRenderer`

React hook bridging the render-graph into `useFrame`:

```ts
type MatrixRainRenderer = {
  tick: (deltaSeconds: number, elapsedSeconds: number) => void;
  regenerate: () => void;
  columnCount: number;
};
```

The final shipped `<MatrixRainWebGPU>` component (M9) will collapse these into the closed prop list from spec §5.2.

---

## Coordinate conventions

### Drawing-buffer pixels everywhere

The lib operates entirely in **drawing-buffer pixels** (= device pixels for a normally-configured canvas):

- `Uniforms.resolution` is the canvas drawing-buffer size (`canvas.width × canvas.height`).
- `Uniforms.cellSize` is in drawing-buffer pixels.
- The shader's `pixelPos = uv * resolution` is in drawing-buffer pixels.

The **demo** is responsible for the CSS→device conversion. `App.tsx` passes `fontSize * DPR` where `DPR = window.devicePixelRatio || 1`. This keeps the GPU shader unit-clean.

DPR is a **one-time snapshot** at hook init. Cross-monitor drag with a DPR change won't rebuild the graph until M9 lifecycle work.

### uv convention

`common.fullScreenTriangle` gives `uv ∈ [0, 1]²` with `uv.y = 0` at the top of the canvas, `uv.y = 1` at the bottom. The Y-down convention matches WebGPU framebuffer coordinates. `headY` increases over time (drops fall **down**); a column's trail extends upward from `headY` to `headY - tailLength`.

---

## Key invariants

### Hash invariant — spatial glyph anchoring

`glyphIndex(seed, slotY)` is a **pure function** of `(column.seed, row)`. Two consequences:

1. **Within a column's lifetime** (between respawns), every row's glyph is fixed. As `headY` advances, glyphs don't change; only their visibility (whether they're in the current tail window) and their brightness (function of `k = headY - row`).
2. **On respawn**, `column.seed` rotates → all rows of that column re-roll their glyphs simultaneously.

This is what makes the rain feel like characters etched into the screen, not characters scrolling with the drop. See [`docs/GLOSSARY.md#hash-invariant`](GLOSSARY.md#hash-invariant).

### Density semantic — `randf > density`

Locked at M2-T2.2; matches the chicio-blog 2D reference's `Math.random() > density`. High density = fewer respawns per step = drops sit off-screen longer between runs. **Inverse of the plan snippet** (which had `randf < density`); preserved at M2 close for 2D parity.

At density = 1.0, respawn never fires (since `randf` returns `[0, 1)`); screen eventually empties. Useful slider range for visible rain: 0.90–0.98.

### SDF signed convention

`r8unorm` atlas texture; per pixel:

- byte 0 → far outside the glyph (~−SPREAD px)
- byte 127 → on the glyph edge (signed distance ≈ 0)
- byte 255 → far inside the glyph (~+SPREAD px)

SPREAD = 8 (pixels each side of the edge). After GPU sampler normalizes byte → f32, edge sits at `sample.x = 0.5`. Smoothstep around 0.5 with a `fwidth`-sized band gives sub-pixel-precision anti-aliasing at any rendering scale. See [`docs/GLOSSARY.md#sdf`](GLOSSARY.md#sdf).

---

## Lifecycle

### Hook construction (lazy)

`useMatrixRainRenderer` does not create the render-graph in a `useEffect`. Instead:

- A `useEffect` on mount bakes the SDF atlas (`buildSdfAtlas()`) and stores it in a ref.
- The first call to `tick()` checks `ctx + atlas` and lazy-constructs the render-graph if both are ready.

This avoids the "ctx is null on mount, becomes available later" dance that async-context patterns require.

### Resize handling

`graph.resize(w, h)` runs every tick. Idempotent: only reallocates the `Column[]` buffer + pipelines when `columnCount` actually changes. Pipelines are re-created because they capture the columns buffer reference at shader-resolve time.

### cellSize changes

Trigger full graph reconstruction via the hook's `useEffect([args.cellSize])` cleanup → next tick lazy-rebuilds.

### Disposal

`dispose()` destroys the uniforms buffer + columns buffer + atlas texture, nulls pipeline references. Hook's cleanup runs on unmount.

---

## Per-milestone trajectory

### M0 — Project setup + demo shell

Demo harness: right-rail debug panel (320px) with disabled controls + render-mode selector + observability widget. `src/demo/debug-panel/` hosts the rail primitives.

**Naming drift:** `<DebugPanel />` is the wrapper; `<Effects />` is the disabled controls component. (Plan originally called the latter `DebugPanel`.) See memory `[[project-current-progress]]`.

### M1 — Hello triangle + time uniform

Replaces scaffold gradient with a `useUniform(d.f32)` time-driven full-screen pulse. FPS readout in observability widget (EMA-smoothed, flushed to state every 1.0s).

### M2 — Column state + falling rectangles

Introduced:

- `Column` + `Uniforms` schemas (TypeGPU `d.struct`)
- `PALETTE` constants
- `render-graph.ts` vanilla factory
- `compute-step.ts` compute pipeline (advance heads, respawn with density-gated `randf > density`)
- `render-glyphs.ts` (original "solid rectangles" version)
- `use-matrix-rain-renderer` hook
- Density / stepRate / fontSize sliders + regenerate-seeds button + column-count readout

Locked at M2 close: density semantic, signed-distance convention, hook lifecycle pattern.

### M3 — SDF glyph atlas

Added:

- `glyph-set.ts` (48 chars; missing '6' preserved verbatim from 2D reference)
- `build-sdf-atlas.ts` — runtime CPU baker (rasterize → binary mask → 8SSEDT twice for signed → encode as `r8unorm` byte). Two raster sweeps over a `(offsetX, offsetY)` per-pixel offset array; combined into signed via `binary ? +distFromOutside : −distFromInside`. Atlas published as `Uint8Array` of 48 × 64 × 64 = 196,608 bytes.
- GPU upload of atlas as `r8unorm` 2D-array texture via `root.unwrap(tex)` + `root.device.queue.writeTexture()` (raw bytes; `tex.write()` only accepts ImageBitmap/ImageData/canvas).
- `render-atlas-debug.ts` — centered single-glyph diagnostic mode with smoothstep AA.

### M4 — Per-cell glyphs

Replaced M2's "rectangle per column" with **per-cell glyph rendering**:

- `hash.ts`: `glyphIndex(seed, slotY)` picks the atlas layer per cell; `brightnessJitter(seed, slotY)` returns ±60% variation (decorrelated via a `BRIGHTNESS_SALT = 1.7` offset on slotY).
- `render-glyphs.ts` rewritten: uv → `(col, row, localUv)`; `k = headY - row`; atlas sample with smoothstep AA via `edgeHalfBand = fwidth(localUv.x) * 0.5`; `coverage = smoothstep(0.5 - edgeHalfBand, 0.5 + edgeHalfBand, sample.x)`; brightness = `tailFalloff × depthDimming × (1 + trailJitter)` clamped.
- `atlasBindings` extracted to its own `src/lib/gpu/atlas/bindings.ts` (shared between debug + production pipelines).
- Tuned defaults: `DEFAULT_STEP_RATE = 10`, `DEFAULT_FONT_SIZE = 20`, `JITTER_RANGE = 0.6`.

**Color model deviation from plan:** plan T4.2 step 3 asked for a deterministic-vs-probabilistic toggle. We chose a **hybrid** instead — deterministic gradient × per-cell ±60% jitter (clamped at head). Film looks like "deliberate gradient with organic variation"; the hybrid is closer than either pure option would be.

**`state-debug` deviation:** after M4-T4.3 wired `glyphs-flat` to the same render path as `state-debug`, the two modes produce identical output. The original "M2 rectangles for comparison" view is gone (the render-glyphs.ts rewrite was wholesale). Resurrectable as a dedicated pipeline if useful post-M6.

### M5+ — In progress / planned

| Milestone | Adds |
|---|---|
| M5 | Per-column speed + depth + **tailLength** (added at M4 close); depth-modulated brightness + soft glyphs for far columns |
| M6 | HDR offscreen target; brightness extract; separable Gaussian blur (ping-pong); additive bloom combine |
| M7 | CRT pass (scanlines + chromatic aberration + tone-map) |
| M8 | Mouse + scroll interaction (per-column force via uniforms) |
| M9 | `paused` static frame, split-purpose ResizeObserver, three-mode error handling, formalize `<MatrixRainWebGPU>` API |
| M10 | npm publish — package build, README full content, dependency audit |

---

## Open decisions / pending re-evaluation

- **M5 — tailLength × speed correlation.** Currently independent rolls. The film shows "fast = long streamer" as a dominant pattern. M5 verification step includes evaluating whether to add weak correlation.
- **Atlas-debug mode lifetime.** Kept post-M3 as a diagnostic. Plan permits retiring after M4 close. Currently retained — useful for verifying any future atlas re-bake.
- **state-debug mode lifetime.** Identical to glyphs-flat after M4-T4.3. M6+ post-process layers may make a raw-state view useful again; resurrect as a dedicated pipeline if so.
- **DPR snapshot.** One-time at hook init. Cross-monitor DPR change won't trigger rebuild until M9 lifecycle work.

---

## Cross-references

- Term reference: [`docs/GLOSSARY.md`](GLOSSARY.md)
- Design intent (pre-implementation): [`docs/superpowers/specs/2026-06-07-matrix-rain-webgpu-design.md`](superpowers/specs/2026-06-07-matrix-rain-webgpu-design.md)
- Milestone checkboxes / commit log: [`docs/superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md`](superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md)
