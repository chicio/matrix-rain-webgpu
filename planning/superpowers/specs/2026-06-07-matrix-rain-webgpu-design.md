# Matrix Rain WebGPU — Design

**Status:** Draft for review
**Owner:** Fabrizio Duroni
**Date:** 2026-06-07
**Project directory:** `/Users/fduroni/Code/Fabrizio/matrix-rain` (rename to `matrix-rain-webgpu` pending; non-blocking)
**Package name (published):** `matrix-rain-webgpu`
**Main exported component:** `<MatrixRainWebGPU>`

---

## 1. Goal

Build a standalone npm package `matrix-rain-webgpu` that reimplements the existing chicio-blog matrix rain (`chicio-blog/src/components/design-system/atoms/effects/matrix-rain.tsx`) using TypeGPU + WebGPU in React. The package serves three goals at once:

1. **Study/refresh** of computer graphics on a modern GPU pipeline — compute → render → post-process.
2. **Publish** a working npm package consumable from any React + WebGPU app.
3. **Article** — each implementation milestone is one section of a future blog post.

Eventual integration with https://www.fabrizioduroni.it (replacing the 2D canvas effect, with the 2D as fallback when WebGPU is unavailable) is the **last milestone**. It is intentionally not designed in detail here — its shape will emerge from the package outcome and from a parallel refactor of the existing 2D component on the chicio-blog side.

## 2. Non-goals (v1)

- 2D canvas fallback **inside** the package — fallback is the consumer's job
- Per-character glyph morphing — deferred to v2; v1 matches the 2D's "frozen once placed" semantics
- Themeable color palette — the green Matrix palette is hard-coded
- Cross-browser/cross-GPU test matrix — Chromium-with-WebGPU is the development target
- Automated tests (unit, e2e, visual regression) — deferred to a post-publish milestone
- React Native target — concept reuse on `react-native-webgpu` is a future, separate project
- Imperative ref API on the component — everything is controllable via props

## 3. Architecture

### 3.1 Repository layout

```
matrix-rain-webgpu/
├── src/
│   ├── lib/                          # the publishable package
│   │   ├── index.ts                  # public exports
│   │   ├── matrix-rain.tsx           # <MatrixRainWebGPU> — thin, composes hooks
│   │   ├── feature-detect.ts         # isWebGPUSupported()
│   │   ├── types.ts                  # public props/option types
│   │   ├── gpu/
│   │   │   ├── schemas.ts            # TypeGPU d.struct schemas (Column, Uniforms)
│   │   │   ├── palette.ts            # hard-coded Matrix green palette constants
│   │   │   ├── hash.ts               # WGSL deterministic hash helpers
│   │   │   ├── pipelines/
│   │   │   │   ├── compute-step.ts   # compute: advance drops + apply mouse/scroll force
│   │   │   │   ├── render-glyphs.ts  # instanced quads, SDF atlas sampling, depth dim
│   │   │   │   ├── bloom.ts          # brightness extract + separable Gaussian blur + combine
│   │   │   │   └── crt.ts            # scanlines + chromatic aberration
│   │   │   ├── atlas/
│   │   │   │   ├── glyph-set.ts      # character set + atlas layout metadata
│   │   │   │   └── build-sdf-atlas.ts# runtime build of the SDF atlas texture
│   │   │   └── render-graph.ts       # orchestrates compute → render → bloom → crt per frame
│   │   └── hooks/
│   │       └── use-matrix-rain-renderer.ts  # wires render-graph into @typegpu/react's useFrame
│   └── demo/                         # NOT part of the package — dev verification harness (Section 7)
│       ├── App.tsx
│       └── ...
├── docs/superpowers/specs/           # this document and future spec docs
├── package.json
├── tsconfig.*.json
├── vite.config.ts
└── index.html
```

Each subdirectory under `gpu/` maps to one milestone (Section 8), so the file you're working in always matches the concept you're learning.

### 3.2 Render pipeline per frame

Every display-refresh frame:

1. **Compute pass** (only when the logical step interval has elapsed; default 20 Hz) — advances per-column state in a storage buffer (`headY`, glyph reset on respawn, mouse/scroll force).
2. **Glyph render pass** — instanced draw, one quad per visible cell in each column, samples the SDF atlas, applies depth dim, writes into an HDR offscreen color texture (`rgba16float`).
3. **Bloom pass** — brightness extract → two separable Gaussian blurs (down-sampled, ping-pong) → additive combine over the scene.
4. **CRT pass** — scanline modulation + chromatic aberration; tone-maps the HDR texture into the swap-chain canvas.

The compute pass is cheap because it runs rarely; the render pass scales with resolution. This split is what gives a 20 Hz "stepping cadence" feel while keeping the canvas smooth at the display refresh rate.

## 4. GPU data model

### 4.1 Per-column state (storage buffer)

```ts
const Column = d.struct({
  headY:   d.f32,   // y of the bright leading char, in cells (continuous-valued for interpolation)
  speed:   d.f32,   // cells advanced per logical step (random per column → parallax)
  depth:   d.f32,   // 0..1; derived from `speed` at column spawn and then frozen for the column's life
  tailLen: d.f32,   // length of the fading tail behind the head, in cells; set at spawn, frozen
  seed:    d.u32,   // per-column random; render shader uses hash(seed, slotY) to pick glyphs
});
// Buffer length = ceil(canvasWidthPx / fontSizePx) = columnCount
```

`depth` and `tailLen` are both initialized when a column is born (mount, resize-grow, or post-fall respawn) and never mutated by the compute pass. Only `headY` is mutated per logical step; `seed` is rotated on respawn only.

**Glyphs are derived, not stored.** The render shader computes the glyph at cell `(column c, slot y_cell)` as `hash(Column[c].seed, y_cell) % NUM_GLYPHS`. The seed is re-rolled only when a column resets (falls off-screen and respawns). Result: per-cell glyphs are stable for the column's lifetime — same semantic as the existing 2D — without per-cell state.

The trail brightness/fade is also derived, not accumulated: a cell at distance `k = headY - y_cell` below the head gets `brightness = falloff(k, tailLen, depth)`. This replaces the 2D's `fillRect(alpha=0x10)` accumulation hack with an analytic shader expression.

**Color-model difference vs the 2D — flagged for milestone 4.** The existing 2D component picks each glyph's color *probabilistically* from a six-bucket palette (`#00FF41`, `#39FF14`, `#00CC33`, `#003D10`, …) when the char is first drawn, then alpha-fades the whole frame uniformly. The WebGPU version's `brightness = falloff(k, ...)` is, by default, a monotone-in-distance gradient (deterministic, no stochastic spread within a column). Choice during milestone 4: either (a) keep the cleaner deterministic gradient — slightly different look but simpler; or (b) recover the stochastic flavor by multiplying base brightness by `hash3(seed, y_cell)` mapped into the same six probability buckets the 2D uses — closer to 2D parity. Decision deferred to implementation time; either approach fits this schema unchanged.

The HDR scene texture is cleared each frame to the **same settled background color** the 2D produces: `#001100` (= `vec4f(0, 17/255, 0, 1)`). The 2D arrives at this color via its `#00110010` alpha-rect accumulation; we arrive at it directly via the clear color. Visually identical settled state, no accumulation needed (the trail fade is already analytic in the glyph shader). The constant lives in `gpu/palette.ts` as `BACKGROUND`.

### 4.2 Uniforms (per frame, CPU-written)

```ts
const Uniforms = d.struct({
  time:           d.f32,   // seconds since mount
  stepProgress:   d.f32,   // 0..1 progress through the current logical step; drives sub-step interpolation
  resolution:     d.vec2f, // canvas pixel size
  cellSize:       d.f32,   // = fontSize (px)
  density:        d.f32,
  mousePos:       d.vec2f, // in cell coords; (-1,-1) when no interaction; px→cell conversion done CPU-side in the React hook before uniform write
  mouseStrength:  d.f32,   // decays after the cursor stops moving
  scrollVel:      d.f32,   // px/sec, decays
  flags:          d.u32,   // bit 0: paused (one-shot static frame requested); bits 1..31 reserved
});
```

### 4.3 Time model

- A **logical step** advances at `stepRate` Hz (default 20). Each step: compute shader runs, `headY += speed` per column, columns past the bottom respawn (gated by `density`).
- Each **render frame** (display refresh, 60/120 Hz+): render shader reads the latest `Column` buffer and `stepProgress` to draw `headY` at the sub-step fractional position. This gives smooth motion even while logical state ticks at 20 Hz.

### 4.4 Resource lifecycle

| Resource | Created | Recreated | Destroyed |
|---|---|---|---|
| SDF glyph atlas (R8 texture array) | mount | never | unmount |
| Column state buffer | mount | column count changes | unmount |
| Uniforms buffer | mount | never | unmount |
| HDR scene texture, bloom ping-pong textures | mount | canvas pixel size changes | unmount |
| Compute / render pipelines | mount | never | unmount |
| Bind groups | mount | whenever a resource above is recreated | unmount |

`gpu/render-graph.ts` owns this lifecycle. The React hook (`use-matrix-rain-renderer.ts`) drives `init`, `resize`, `step`, `render`, `dispose`.

### 4.5 SDF atlas — runtime built, not pre-baked

Built once on mount: render each glyph (kana + digits + symbols, deduped from the existing 2D set in `matrix-rain.tsx`) to an offscreen 2D canvas, run a small JS distance-transform to compute the SDF per glyph, upload as a single R8 texture array (one layer per glyph). Cost is one-time, ~5–20 ms. Avoids shipping baked binary assets. If this becomes a startup bottleneck we move to build-time baking later (no API change required).

## 5. React component API

### 5.1 Public surface

```ts
// src/lib/index.ts
export { MatrixRainWebGPU } from "./matrix-rain";
export { isWebGPUSupported } from "./feature-detect";
export type {
  MatrixRainProps,
  BloomOptions,
  CrtOptions,
  ParallaxOptions,
  // InteractionOptions — CUT at M8 (see milestone table)
} from "./types";
```

Three exports total. No imperative ref API in v1.

### 5.2 Props

```ts
interface MatrixRainProps {
  // Visual base (parity with the existing 2D)
  fontSize?: number;          // px, default 14
  density?: number;           // 0..1, prob. a column does NOT respawn; default 0.975
  stepRate?: number;          // logical Hz; default 20

  // Off-state — single source of truth, consumer composes reduced-motion / offscreen / toggle into it
  paused?: boolean;

  // v1 effects — structured options, or false to disable
  bloom?: BloomOptions | false;             // default { intensity: 1, threshold: 0.7 }
  crt?: CrtOptions | false;                 // default { scanlineStrength: 0.15, aberration: 0.4 }
  parallax?: ParallaxOptions | false;       // default { speedRange: [0.6, 1.6], depthDim: 0.5 }
  // interaction?: CUT at M8 (2026-06-11) — cursor/scroll reactivity distracts in a background effect.

  // Misc
  className?: string;
  onError?: (err: Error) => void;
}
```

Defaults live in code, not docs — reading types shows everything. The canvas is `absolute inset-0 pointer-events-none` and fills its parent; the consumer chooses the size by sizing the parent. This matches the existing 2D component's behavior so consumers can swap implementations without changing their layout.

### 5.3 `paused` semantics

`paused` is the **only** off-state knob the package exposes. Reduced-motion, offscreen-via-IntersectionObserver, and any user toggle are the consumer's responsibility to merge into this one boolean.

When `paused` transitions to `true`:
1. The compute shader is dispatched enough times to produce a settled-looking image (mirrors the 2D's static-frame-by-looping behavior). The concrete iteration count is decided at milestone 9 — a reasonable default is `ceil(canvasHeightInCells / averageSpeed)` so every column has stepped past its starting position at least once.
2. One render frame is drawn.
3. `useFrame` is unsubscribed.

When `paused` transitions back to `false`: `useFrame` re-subscribes; the loop resumes from the current buffer state.

### 5.4 What we explicitly do NOT do at the API level

- No `respectReducedMotion` prop — consumer combines it into `paused`.
- No `theme` prop — palette is constant.
- No `IntersectionObserver` integration — consumer wraps with their own visibility check.
- No internal feature-detect — `<MatrixRainWebGPU>` mounted without WebGPU returns `null` and `console.warn`s once. The primary support-check path is the exported `isWebGPUSupported()`.

## 6. Error handling & lifecycle

### 6.1 GPU device — delegated to @typegpu/react

We never call `navigator.gpu.requestAdapter()` ourselves. `useRoot()` from `@typegpu/react` owns the `GPUDevice` and disposes on unmount. The root's lost-promise is wired to `onError`.

### 6.2 Resize behavior

```
ResizeObserver fires
    └─→ debounce 100ms
         └─→ read new canvas pixel size (clientWidth*dpr, clientHeight*dpr)
              ├─ unchanged → no-op
              ├─ pixel size changed → recreate HDR + bloom textures; reconfigure swap chain
              │   └─ if new columnCount !== old (only possible on width changes)
              │       → recreate column state buffer with fresh seeds
              │   (height-only changes: render targets recreate, column state preserved —
              │    mobile address-bar friendly, mirrors the 2D's `lastWidth.current` guard)
              └─→ recreate bind groups that referenced anything recreated
                   └─→ resume rAF
```

### 6.3 Three failure modes

1. **GPU init failure** (e.g. pipeline compile fails on mount, atlas upload throws) — caught in init `useEffect` → `onError(err)` → component renders `null` → log once. Re-mounting (different `key`) retries.
2. **Device lost mid-session** — `TgpuRoot.lost` resolves → `onError(err)` → cancel `useFrame` → dispose resources. **No automatic retry** (auto-retry on a wedged GPU is a loop-forever footgun; the consumer decides).
3. **Per-frame errors** (rare: hot-reloaded shader validation, resize OOM) — caught around each `device.queue.submit()` → loop stops → `onError(err)` → log once.

In all three the loop is dead after the error — no zombie rAF. If `onError` isn't provided, `console.error` and stop silently. **Never throw** out of the component — host React tree is not allowed to crash because of a background effect.

## 7. Verification (no automated tests in v1)

### 7.1 Gates that run during development

| Gate | What it covers | Status |
|---|---|---|
| Type check (`tsc -b`) | API contracts, `'use gpu'`-side shader types via `tsover` | already wired |
| Lint / format (`oxlint` + `oxfmt`) | Style, dead code, common pitfalls | already wired |
| **Per-milestone manual verification via the demo** | "Does the demo show the new effect, no console errors, no FPS regression?" | this section |

No `vitest`, no `@playwright/test`, no `*.test.ts` files in `src/lib/**` during v1. This is an **explicit, conscious deferral**, not an oversight. After publish, we revisit.

### 7.2 The demo is the verification harness

`src/demo/` is **not** a marketing example. It is the per-milestone observation surface that replaces automated tests during v1. It grows in lockstep with the library; **a milestone is not complete until the demo can exercise the new capability**.

Required demo features by the time the relevant milestone closes:

- **Sized container with a drag handle** for the canvas (verifies resize splits).
- **Debug panel** with toggles for every effect (`bloom`, `crt`, `parallax`, `interaction`) and sliders for every tunable param (`fontSize`, `density`, `stepRate`, all the `*Options` fields).
- **`paused` toggle** — testable without needing `prefers-reduced-motion`.
- **Regenerate seeds** button — forces all columns to respawn; verifies reset paths.
- **Observability widgets** — FPS / frame-time readout, current canvas pixel size + column count, in-page console panel for runtime errors (so DevTools doesn't need to be open).
- **Render-mode selector** exposing intermediate pipeline stages — used both for debugging and as the article's narrative scaffold:
  - `state-debug` (columns as colored rectangles, no glyphs)
  - `glyphs-flat` (atlas glyphs, no bloom/CRT/parallax)
  - `glyphs-parallax` (+ parallax)
  - `glyphs-bloom` (+ bloom)
  - `glyphs-crt` (full pipeline)

### 7.3 Per-milestone verification checklist

Each milestone closes with a checklist like:

> **Milestone 6 — Bloom — verify:**
> - [ ] Bright heads visibly glow into adjacent pixels in the demo
> - [ ] `bloom={false}` in the debug panel removes the glow entirely
> - [ ] `bloom.intensity` slider visibly affects the result
> - [ ] No console errors when toggling
> - [ ] Chrome Performance tab: render frame time hasn't regressed vs milestone 5

If a checklist item cannot be exercised through the demo, the demo is missing a control — add it inside the same milestone.

The per-milestone checklists themselves are authored during their milestone, not in this spec — the spec only fixes the template above and the discipline.

### 7.4 Deferred to post-v1

- Vitest unit tests for pure logic (hash, atlas builder, palette, `isWebGPUSupported`)
- One Playwright smoke test of the demo (green-pixel count, no console errors)
- CI workflow

Added if and when judged worth the maintenance cost.

## 7bis. TypeGPU ecosystem packages — what we actually use

The project was scaffolded with several `@typegpu/*` packages pre-installed. This subsection assesses which earn their dependency for v1 and which get uninstalled in milestone 10.

| Package | Verdict for v1 | Where it earns its keep |
|---|---|---|
| `@typegpu/react` | **Keep** | Used in every milestone. `useRoot`, `useFrame`, `useConfigureContext`, `useUniform`, `useMirroredUniform`. |
| `@typegpu/noise` | **Keep** | Milestone 4: `randf.seed2 + randf.sample` for the per-cell glyph hash and per-column seed init. Possibly milestone 8 for organic-feeling cursor disturbance. |
| `@typegpu/color` | **Probably keep** | Likely needed in milestones 6–7 for linear ↔ sRGB conversions (proper bloom + clean tone-mapping in the CRT pass). Final keep/drop decision at milestone 7 close. |
| `@typegpu/sdf` | **Likely uninstall at milestone 10** | Provides primitive SDFs (`sdDisk`, `sdBox2d`, `opSmoothUnion`). Our glyph atlas is baked-from-font, not procedural, so these primitives don't apply. Re-evaluate during milestone 3 — if any auxiliary UI element (interaction halo, drag handle in the demo) is built procedurally with SDFs, the package earns its place. |
| `@typegpu/radiance-cascades` | **Uninstall at milestone 10** | 2D global illumination via radiance cascades is a significant feature in its own right, separate from bloom. Out of scope for v1; bloom covers our "glow" need. **Tagged as the strongest v2 candidate**: "make the bright Matrix heads cast real soft light into the surrounding darkness via radiance cascades" would be a striking visual upgrade and a great follow-up article on its own. |

**Milestone 10 includes an explicit dependency audit step**: re-run the verdicts above against actual usage, uninstall what isn't imported, and pin the kept versions before publish.

## 8. Milestones (study plan)

Ten milestones. Each is one article section, one git tag (once the repo is `git init`-ed), and produces a runnable demo. Per the collaborative-coding preference, each milestone will be further sub-divided into the smallest practical steps during implementation — the ten below are the **article-section** granularity.

| # | Title | Concepts learned | Demo additions |
|---|---|---|---|
| 1 | Hello triangle + full-screen pass | `useRoot`, `useFrame`, `useConfigureContext`, render pipeline, uniform buffer round-trip | uniform-driven background, FPS readout |
| 2 | Column state buffer + falling rectangles | storage buffers, compute pipelines, bind groups, instanced quads, `Column` schema | `state-debug` render mode, regenerate-seeds button, canvas size readout |
| 3 | SDF glyph atlas — build + render one glyph | textures, texture arrays, sampling, SDF math, runtime atlas building | atlas size shown, single-glyph preview |
| 4 | Full atlas + per-cell glyphs from `hash(seed, slotY)` | deterministic WGSL hashing, atlas indexing, brightness falloff math | `glyphs-flat` render mode, `density` slider |
| 5 | Parallax: per-column speed + depth-modulated dim/blur | per-instance attributes, fragment-side depth modulation | `glyphs-parallax` render mode, `parallax` toggle + sliders |
| 6 | Bloom post-process | multi-pass rendering, HDR offscreen, ping-pong textures, separable Gaussian blur, additive combine | `glyphs-bloom` render mode, `bloom` toggle + sliders |
| 7 | CRT pass (scanlines + chromatic aberration) | post-process chain composition, uv tricks, tone mapping to swap chain | `glyphs-crt` (full) render mode, `crt` toggle + sliders |
| ~~8~~ | ~~Mouse + scroll interaction~~ | **CUT (2026-06-11)** — built then removed; cursor/scroll reactivity distracts in a background effect. No `0.8.0` tag. | — |
| 9 | `paused` static frame + resize parity + error handling | cleanup contracts, lifecycle correctness, settled-snapshot semantics | `paused` toggle, in-page console for runtime errors |
| 10 | API polish + publish | public exports lock, `package.json` `exports`, README, version 0.1.0, npm publish, **dependency audit (Section 7bis): uninstall any `@typegpu/*` package not actually imported** | install the published package in a throwaway project and import it — verifies consumability |

Milestones 11+ (post-v1):

- **Integration with chicio-blog** — refactor the 2D component to take `paused`, build a wrapper hook combining `useReducedMotions` + `useIntersectionPause` + `isWebGPUSupported`, swap rendering in `https://www.fabrizioduroni.it`. Designed when reached.
- **Article publication** — composed from the per-milestone notes and verification checklists.
- **Tests** — vitest + Playwright if judged worth the maintenance cost.
- **v2 features** — per-character glyph morphing, hidden "Wake up Neo" message, themeable palette.
- **v2 experiment: radiance cascades** — adopt `@typegpu/radiance-cascades` to make bright Matrix heads cast soft volumetric light into the surrounding darkness. Distinct effect from bloom (proper light propagation respecting scene geometry vs. screen-space blur). Strong candidate for a stand-alone follow-up article.

## 9. Open questions

None blocking. The following are decisions intentionally **deferred** to implementation time:

- Exact debounce duration on resize (proposed 100 ms vs the 2D's 300 ms — pick during milestone 9).
- SDF atlas resolution per glyph (probably 32² or 64² — tune during milestone 3).
- Bloom downsample factor and blur kernel size (tune during milestone 6).
- Whether the chicio-blog wrapper hook `useIntersectionPause` is generic enough to live next to `useReducedMotions` (decision made during milestone 11, not now).

## 10. Glossary

- **Logical step**: a tick of the compute shader that advances per-column state. Defaults to 20 Hz.
- **Render frame**: a tick of the render pipeline that draws to the canvas. Runs at display refresh.
- **Cell / slot**: one grid square in a column, sized `fontSize × fontSize` px. Indexed by `(column index, slot y)`.
- **Head**: the bright leading character of a column — the bottom-most visible char (rain falls downward).
- **Tail**: the cells above the head, fading with distance.
- **SDF**: signed distance field — a texture whose values encode signed distance to the glyph's edge, enabling sharp scaling and easy effects.
- **HDR scene texture**: the offscreen color target where the glyph render pass writes pre-bloom output. `rgba16float` so bloom has real bright values to extract.
- **Ping-pong textures**: two textures alternated as read/write target during multi-pass blur.
- **Step progress**: 0..1, the fractional position of the current render frame between the previous and next logical step. Drives sub-step interpolation in the render shader.

---

*Last revised: 2026-06-07. Authored collaboratively with Claude during the project's brainstorming session.*
