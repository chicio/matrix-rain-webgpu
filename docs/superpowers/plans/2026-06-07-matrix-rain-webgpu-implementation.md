# matrix-rain-webgpu Implementation Plan

> **For agentic workers:** REQUIRED — use `superpowers:subagent-driven-development` OR `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. **Adapted from the skill default:** automated tests are intentionally deferred per the spec; **verification of each step is performed manually in the demo app** (see [feedback-demo-is-verification](../../../.claude/projects/-Users-fduroni-Code-Fabrizio-matrix-rain/memory/feedback_demo_is_verification.md)). The author also prefers **pair-coding** for many steps ([feedback-collaborative-coding](../../../.claude/projects/-Users-fduroni-Code-Fabrizio-matrix-rain/memory/feedback_collaborative_coding.md)) — when executing, default to discussing the change before writing code unless the step is clearly mechanical.

**Goal:** Build the `matrix-rain-webgpu` npm package — a React + TypeGPU + WebGPU implementation of the chicio-blog matrix rain effect — in ten study milestones, each verifiable in the demo app, ending in an npm publish.

**Architecture:** Compute pass updates per-column state in a storage buffer; render pass draws instanced quads sampling an SDF glyph atlas; bloom (multi-pass) and CRT (single-pass) post-processes; `<MatrixRainWebGPU>` is a thin React component that composes hooks from `@typegpu/react`. Full design: [`docs/superpowers/specs/2026-06-07-matrix-rain-webgpu-design.md`](../specs/2026-06-07-matrix-rain-webgpu-design.md).

**Tech Stack:** TypeScript (`tsover`), React 19, Vite, TypeGPU + `@typegpu/react` + `@typegpu/noise` + (probably) `@typegpu/color`, oxlint + oxfmt.

---

## File Structure

Final layout (built up incrementally across chunks):

```
src/
├── lib/                                # the publishable package
│   ├── index.ts                        # public exports
│   ├── matrix-rain.tsx                 # <MatrixRainWebGPU>
│   ├── feature-detect.ts               # isWebGPUSupported()
│   ├── types.ts                        # public types
│   ├── gpu/
│   │   ├── schemas.ts                  # Column, Uniforms TypeGPU schemas
│   │   ├── palette.ts                  # BACKGROUND, HEAD, TRAIL, FADE constants
│   │   ├── hash.ts                     # deterministic hash helpers for WGSL
│   │   ├── render-graph.ts             # init / resize / step / render / dispose
│   │   ├── atlas/
│   │   │   ├── glyph-set.ts            # the character set
│   │   │   └── build-sdf-atlas.ts      # runtime SDF baking
│   │   └── pipelines/
│   │       ├── compute-step.ts         # advance heads + apply force
│   │       ├── render-glyphs.ts        # instanced quads + SDF sampling
│   │       ├── bloom.ts                # extract + blur (ping-pong) + combine
│   │       └── crt.ts                  # scanlines + aberration + tone map
│   └── hooks/
│       └── use-matrix-rain-renderer.ts # wires render-graph to useFrame
├── demo/                               # dev verification harness, NOT published
│   ├── App.tsx
│   ├── debug-panel.tsx                 # toggles + sliders per effect
│   ├── observability.tsx               # FPS, canvas size, in-page error console
│   ├── render-mode.tsx                 # render-mode selector
│   └── index.css
└── main.tsx                            # Vite entry — renders demo/App.tsx
```

`gpu/pipelines/` files appear one-per-milestone in the order M2 → M3-4 → M6 → M7.

---

## Chunk 0: Project setup & demo shell

**Purpose:** Get the repo into a state where future chunks have a clean place to drop code. Initialize git so commits work. Move the scaffold's gradient demo aside.

### Task 0.1: Initialize git

**Files:** repo root.

- [x] **Step 1:** `cd /Users/fduroni/Code/Fabrizio/matrix-rain && git init -b main` *(done — user ran this; baseline `f0daf1f Init commit :tada:`)*
- [x] **Step 2:** Confirm `.gitignore` already covers `node_modules/`, `dist/`, build artifacts. Currently it does (look at line counts of existing `.gitignore`). *(verified — covers logs, node_modules, dist, dist-ssr, \*.local, editor files)*
- [x] **Step 3:** First commit *(done as two commits: `f0daf1f` for scaffold + initial spec, `0f18d46` for plan + spec revisions)*
- [x] **Step 4:** Do **not** tag yet. M0 closes with a single `0.0.0` tag at the end of Task 0.4 once the demo shell is in place.

### Task 0.2: Move the scaffold gradient demo into `src/demo/`

**Files:**
- Create: `src/demo/App.tsx` (moved from `src/App.tsx`)
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`

- [x] **Step 1:** `git mv src/App.tsx src/demo/App.tsx`
- [x] **Step 2:** In `src/main.tsx` update the import path from `./App.tsx` to `./demo/App.tsx`. *(also dropped the now-unused `React` import — tsconfig uses automatic JSX runtime)*
- [ ] **Step 3:** Run `pnpm dev` (or `npm run dev`) → verify the typegpu splash still renders. Verification is **visual** in the browser. *(user to confirm out-of-band when convenient)*
- [x] **Step 4:** Run `pnpm run types && pnpm run check` → no errors. *(types pass; format check has 13 pre-existing issues in .md/json files, unrelated to this change — to be addressed in Task 0.3 or 0.4)*
- [x] **Step 5:** Commit: `d617259 chore: move scaffold gradient into src/demo/`

### Task 0.3: Create empty `src/lib/` skeleton with placeholders

**Files:**
- Create: `src/lib/index.ts` (single line: `export {};`)
- Create: `src/lib/types.ts` (empty)
- Create: `src/lib/feature-detect.ts` (with the real `isWebGPUSupported` — small and safe to land now)
- Create: `src/lib/gpu/.gitkeep` (or `palette.ts` if a placeholder feels cleaner)

- [x] **Step 1:** Create `src/lib/feature-detect.ts` with real `isWebGPUSupported()`.
- [x] **Step 2:** ~~Touch the other placeholder files~~ — adjusted: oxlint's `unicorn/require-module-specifiers` rejects empty `export {}` files, so instead `src/lib/index.ts` now re-exports `isWebGPUSupported` (real content) and `src/lib/types.ts` is deferred to M9 when actual types exist. `src/lib/gpu/.gitkeep` reserves the gpu/ directory.
- [x] **Step 3:** Commit: `3cb7f2f feat(lib): src/lib/ skeleton + isWebGPUSupported`

### Task 0.4: Demo shell with debug panel + observability + render-mode selector skeletons

**Files:**
- Create: `src/demo/debug-panel.tsx`
- Create: `src/demo/observability.tsx`
- Create: `src/demo/render-mode.tsx`
- Modify: `src/demo/App.tsx` (replace the typegpu splash with a layout that has: a sized canvas container, the debug panel, the observability widget, and the render-mode selector — all wired but mostly empty)
- Modify: `src/demo/index.css` (or `src/index.css` — wherever the CSS lands)

- [x] **Step 1:** Build the layout shell. **Decision:** right rail, fixed 320px. CSS grid `1fr var(--rail-width)` on `#shell`; `#stage` holds the canvas full-bleed.
- [x] **Step 2:** `<Effects />` (renamed from `<DebugPanel />`; see note below) shows disabled controls grouped into six fieldsets — Simulation (M2), Parallax (M5), Bloom (M6), CRT (M7), Interaction (M8), Lifecycle (M9). Each `<legend>` carries a `wired in M…` tag.
- [x] **Step 3:** `<Observability />` shows FPS `—`, canvas drawing-buffer size via ResizeObserver (`{w}×{h} @ {dpr}x`), columns `—`, and a scrollable error console capturing `window` `error` + `unhandledrejection`.
- [x] **Step 4:** `<RenderModeSelector />` is a native `<select>` with the five entries; selection lives in App state (`renderMode`), threaded through `<DebugPanel>` via `onRenderModeChange`. No renderer reads it yet.
- [x] **Step 5:** Verified — page loads, layout renders, scaffold gradient still painted by typegpu, no console errors. (Visually confirmed 2026-06-07.)
- [x] **Step 6:** Commit landed as two: `2d913b6 feat(demo): shell with debug panel, observability, render-mode selector` (initial scaffold) → `0a6fbec refactor(demo): split debug-panel into folder; add DebugPanel wrapper` (folder structure refactor).
- [x] **Step 7:** Tag the milestone close: `git tag 0.0.0` *(applied after this docs commit lands)*.

**Note on naming drift from the plan:** the plan called the disabled-controls component `<DebugPanel />`. As we built it, the rail ended up needing a single wrapper that owns `<aside id="rail">` and composes Effects + RenderMode + Observability — that wrapper got the `DebugPanel` name. The disabled-controls component is now `<Effects />` (under `src/demo/debug-panel/Effects.tsx`). All other rail primitives (Group/Slider/Toggle) live alongside it in `src/demo/debug-panel/`.

**Chunk 0 verification:**
- [x] `pnpm dev` opens with the canvas showing the existing gradient, surrounded by the new shell.
- [x] Debug panel shows disabled controls labeled by their target milestone.
- [x] Observability widget shows canvas pixel size that updates if you resize the window.
- [x] No console errors.

---

## Chunk 1: Milestone 1 — Hello triangle + full-screen pass

**Purpose:** Replace the scaffold's static gradient with a uniform-driven full-screen fragment shader. Concepts: `useRoot`, `useFrame`, `useConfigureContext`, `useUniform`, render pipeline, uniform write per frame.

**Files:**
- Modify: `src/demo/App.tsx` (replace inline pipeline)
- Modify: `src/demo/observability.tsx` (FPS now real)

### Task 1.1: Hook up `useUniform(d.f32)` for `time` and use it in the fragment shader

- [x] **Step 1:** In `src/demo/App.tsx`, replace the scaffold's pipeline fragment with one that produces a time-driven color (e.g. a horizontal pulse moving across the canvas — picked together during pair coding). Use the `@typegpu/react` example pattern: `const time = useUniform(d.f32)`, `time.write(elapsedSeconds)` inside `useFrame`. Fragment reads `time.$`.
- [x] **Step 2:** Run `pnpm dev` → animation plays smoothly at display refresh.
- [x] **Step 3:** Verify console is clean (no validation errors from WebGPU).
- [x] **Step 4:** Commit: `feat(m1): time-driven full-screen pass with useUniform`

### Task 1.2: Real FPS readout in the observability widget

- [x] **Step 1:** Inside the `useFrame` callback, compute a smoothed FPS (e.g. exponential moving average of `1/deltaSeconds`, `alpha=0.1`). Stash it in a ref to avoid re-render storms; flush to state every ~250ms. _(Bumped flush to 1.0 s for steadier readout + correct first-reading after EMA settles.)_
- [x] **Step 2:** `<Observability />` renders the FPS from that state.
- [x] **Step 3:** Verify FPS reads ~60 (or display refresh) when the tab is focused, drops when you switch away.
- [x] **Step 4:** Commit: `feat(demo): real FPS readout`

**Chunk 1 verification:**
- [x] Canvas shows a time-driven animation, not a static gradient.
- [x] FPS readout in the observability widget updates and looks plausible.
- [x] No console errors.
- [x] `pnpm types && pnpm check` clean.
- [x] Tag: `git tag 0.1.0`

---

## Chunk 2: Milestone 2 — Column state buffer + falling rectangles

**Purpose:** Introduce the `Column` storage buffer, a compute pass that advances `headY` per logical step, and a render pass that draws each column as a colored rectangle (no glyphs yet). This is the simulation skeleton.

**Files:**
- Create: `src/lib/gpu/schemas.ts`
- Create: `src/lib/gpu/palette.ts`
- Create: `src/lib/gpu/render-graph.ts`
- Create: `src/lib/gpu/pipelines/compute-step.ts`
- Create: `src/lib/gpu/pipelines/render-glyphs.ts` (renders rectangles for now, becomes glyphs in M3-4)
- Create: `src/lib/hooks/use-matrix-rain-renderer.ts`
- Modify: `src/demo/App.tsx` (use the new renderer for `state-debug` render mode)
- Modify: `src/demo/debug-panel.tsx` (enable: `density`, `stepRate`, `fontSize` sliders; regenerate-seeds button)
- Modify: `src/demo/observability.tsx` (column count readout)

### Task 2.1: Define `Column` schema and `palette.ts` constants

- [x] **Step 1:** `src/lib/gpu/schemas.ts`:
  ```ts
  import { d } from "typegpu";

  export const Column = d.struct({
    headY:   d.f32,
    speed:   d.f32,
    depth:   d.f32,
    tailLen: d.f32,
    seed:    d.u32,
  });

  export const Uniforms = d.struct({
    time:          d.f32,
    stepProgress:  d.f32,
    resolution:    d.vec2f,
    cellSize:      d.f32,
    density:       d.f32,
    mousePos:      d.vec2f,
    mouseStrength: d.f32,
    scrollVel:     d.f32,
    flags:         d.u32,
  });
  ```
- [x] **Step 2:** `src/lib/gpu/palette.ts`:
  ```ts
  // Hard-coded Matrix palette. See spec §4.1.
  export const BACKGROUND = [0 / 255, 17 / 255, 0 / 255, 1] as const;
  export const HEAD       = [184 / 255, 255 / 255, 194 / 255, 1] as const; // near-white green
  export const TRAIL      = [0 / 255, 255 / 255, 65 / 255, 1] as const;    // #00FF41
  export const FADE       = [0 / 255, 61 / 255, 16 / 255, 1] as const;     // #003D10
  ```
- [x] **Step 3:** Commit: `feat(m2): Column + Uniforms schemas; palette constants` *(landed as `b7e4ef8`; palette shipped as a single `PALETTE = {background, head, trail, fade} as const` object — see memory `[[project-current-progress]]`)*

### Task 2.2: Render-graph skeleton

- [x] **Step 1:** `src/lib/gpu/render-graph.ts` exposes `createRenderGraph({ root, ctx, cellSize, ... }): { init, resize, step, render, dispose }`. For M2 the implementation is minimal: allocate the column buffer + uniform buffer + create a compute pipeline + create a render pipeline that draws colored rectangles using instanced full-screen draws (one instance per column). *(Built as a vanilla TS factory; `init` collapsed into `resize` — see memory.)*
- [x] **Step 2:** Decide together (pair-coding step) on the seed/headY/speed init RNG and the `randf` integration from `@typegpu/noise`. *(CPU `Math.random()` for init; GPU `randf` for respawn; density semantic locked to `randf > density` to match 2D.)*
- [x] **Step 3:** Commit: `feat(m2): render-graph skeleton (init/step/render/dispose)` *(landed as `27aa4c4` — message reads `feat(m2): render-graph skeleton (resize/step/render/dispose)`, reflecting the collapsed init.)*

### Task 2.3: Compute pass — advance heads

- [x] **Step 1:** `src/lib/gpu/pipelines/compute-step.ts`: a compute shader that reads `Column[i]`, writes `Column[i].headY = headY + speed` (saturating into respawn logic: if `headY * cellSize > height` and `randf.sample() < density`, reset `headY = 0` and rotate `seed`). *(Implemented with the inverted density semantic — `randf > density` — for 2D parity; seed rotation via second `randf.sample() → u32`.)*
- [x] **Step 2:** Dispatch once per logical step (gated by elapsed seconds vs `1/stepRate`) inside `step()`.
- [x] **Step 3:** Commit: `feat(m2): compute pass advances column heads`

### Task 2.4: Render pass — draw columns as rectangles

- [x] **Step 1:** `src/lib/gpu/pipelines/render-glyphs.ts` (despite the name; we'll evolve it across M3-4): full-screen triangle vertex pass, fragment derives column index from `uv.x * columnCount`, looks up `Column[i]`, draws a colored rectangle whose top is at `(headY - tailLen) * cellSize` and bottom at `headY * cellSize`, with `BACKGROUND` everywhere else. Color = `mix(FADE, TRAIL, brightnessAlongTail)`. No glyphs yet. *(Linear falloff `brightness = clamp(1 - k/tailLength, 0, 1)`; `std.select` instead of branches; safeCol guards the right edge.)*
- [x] **Step 2:** Wire the render-mode selector: only render when `mode === "state-debug"`. For other modes, keep showing M1's time gradient (so we can verify the selector switches work). *(Hook `useMatrixRainRenderer` exposes `tick(dt, t)`; App routes inside `useFrame` based on `renderMode`. cellSize threaded as `fontSize × DPR` so the shader operates in device pixels.)*
- [x] **Step 3:** Commit: `feat(m2): state-debug render mode shows falling rectangles`

### Task 2.5: Demo wiring — sliders, regenerate-seeds, column count

- [x] **Step 1:** Enable `density`, `stepRate`, `fontSize` sliders in the debug panel. They write into props on the renderer; `fontSize` change recomputes `columnCount` and re-runs the render-graph init. *(`Group` got a `disabled` prop, default true; Simulation passes `disabled={false}`. `Slider` accepts optional `onChange`. density/stepRate sync per-tick via setters; fontSize triggers full graph disposal + lazy reconstruction via a `useEffect([args.cellSize])` cleanup.)*
- [x] **Step 2:** "Regenerate seeds" button: re-initializes all columns with fresh `seed` and zero `headY`. Verify visually that the falling animation restarts coherently. *(New `regenerate()` on render-graph re-writes the columns buffer in place; hook exposes it as a `useCallback`.)*
- [x] **Step 3:** `<Observability />` reads column count from the renderer's exposed state. *(`getColumnCount()` getter on render-graph; hook polls each tick and flushes to React state when it changes.)*
- [x] **Step 4:** Commit: `feat(demo): m2 debug panel — density, stepRate, fontSize, regenerate seeds`

**Chunk 2 verification:**
- [x] Render mode selector switches between `state-debug` (rectangles falling) and other modes (time gradient placeholder).
- [x] Density slider visibly affects respawn rate. *(Confirmed: density=1 empties the screen — `randf < 1` is always true, so respawn never fires.)*
- [x] stepRate slider changes how fast columns advance.
- [x] fontSize slider changes column width and triggers re-init.
- [x] Regenerate-seeds resets visibly.
- [x] No console errors.
- [x] Tag: `git tag 0.2.0`

---

## Chunk 3: Milestone 3 — SDF glyph atlas (build + render one glyph)

**Purpose:** Build the SDF atlas at runtime (CPU 2D canvas + distance transform → R8 texture array), upload to GPU, and render **one** glyph correctly in a single quad. This is purely a glyph-rendering test bed; column logic is not changed.

**Files:**
- Create: `src/lib/gpu/atlas/glyph-set.ts`
- Create: `src/lib/gpu/atlas/build-sdf-atlas.ts`
- Modify: `src/lib/gpu/render-graph.ts` (own atlas lifecycle)
- Modify: `src/lib/gpu/pipelines/render-glyphs.ts` (sample the atlas)
- Modify: `src/demo/App.tsx` and `src/demo/debug-panel.tsx` (atlas preview)

### Task 3.1: Glyph set

- [ ] **Step 1:** `src/lib/gpu/atlas/glyph-set.ts`:
  ```ts
  // Mirrors chicio-blog/src/components/.../matrix-rain.tsx
  export const GLYPHS = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345789Z:.=*+-<>".split("");
  export const GLYPH_COUNT = GLYPHS.length;
  export const ATLAS_LAYER_SIZE = 64; // px per glyph layer; tune at M3 end
  ```
- [ ] **Step 2:** Commit: `feat(m3): glyph set`

### Task 3.2: CPU-side SDF baker

- [ ] **Step 1:** `src/lib/gpu/atlas/build-sdf-atlas.ts` exports `buildSdfAtlas(): Promise<{ data: Uint8Array; layerCount: number; layerSize: number }>`. Implementation:
  1. Create an offscreen `OffscreenCanvas(layerSize, layerSize)` 2D context.
  2. For each glyph: clear, set monospace font (e.g. `"Courier Prime"` fallback to monospace), draw centered, read back as binary alpha mask, run a small distance transform (8-direction sequential Euclidean approximation; the math is short — write it inline, no library).
  3. Pack each layer's SDF (Uint8 encoded distance) sequentially into one `Uint8Array` of length `layerCount * layerSize * layerSize`.
- [ ] **Step 2:** Pair-coding moment: walk through the distance transform together. Reference: "8SSEDT" or any sequential Euclidean DT; we don't need the most accurate variant, just a usable one.
- [ ] **Step 3:** Commit: `feat(m3): runtime SDF atlas baker`

### Task 3.3: Upload atlas as R8 texture array

- [ ] **Step 1:** In `render-graph.ts` init, await `buildSdfAtlas()`, create a 2D-array texture (`r8unorm`, dimensions `layerSize × layerSize × layerCount`), `writeTexture` from the Uint8Array.
- [ ] **Step 2:** Add a sampler with `magFilter=linear, minFilter=linear, addressMode=clampToEdge`.
- [ ] **Step 3:** Commit: `feat(m3): upload SDF atlas as R8 texture array`

### Task 3.4: Render-glyphs samples a fixed atlas layer

- [ ] **Step 1:** Modify `pipelines/render-glyphs.ts` to draw a single quad in the center of the canvas that samples the atlas at layer 0, using `smoothstep(0.5 - aaWidth, 0.5 + aaWidth, sample)` to anti-alias the glyph edge.
- [ ] **Step 2:** Add a debug-panel slider for "atlas layer" (0..layerCount-1) so we can scrub through and verify every glyph baked correctly.
- [ ] **Step 3:** Demo: add a new render-mode entry `atlas-debug` to the selector enum (the entry didn't exist in Chunk 0's `state-debug | glyphs-flat | glyphs-parallax | glyphs-bloom | glyphs-crt` list). This temporary single-glyph mode lives there. After M4 closes we can remove it or keep it for diagnostics.
- [ ] **Step 4:** Commit: `feat(m3): render-glyphs samples one atlas layer with smoothstep AA`

**Chunk 3 verification:**
- [ ] `atlas-debug` mode shows a sharp, anti-aliased glyph.
- [ ] Scrubbing the atlas layer slider walks through every glyph; none look broken/clipped.
- [ ] Atlas build time printed in console is reasonable (<50ms).
- [ ] `state-debug` mode still works (rectangles falling).
- [ ] Tag: `git tag 0.3.0`

---

## Chunk 4: Milestone 4 — Full atlas + per-cell glyphs via `hash(seed, slotY)`

**Purpose:** Make every visible cell of every column show the right glyph, derived via deterministic hash on the GPU. Implement the brightness falloff for the tail. Pick the color-model variant (deterministic vs probabilistic-flavor — see spec §4.1).

**Files:**
- Create: `src/lib/gpu/hash.ts`
- Modify: `src/lib/gpu/pipelines/render-glyphs.ts`
- Modify: `src/demo/render-mode.tsx` (enable `glyphs-flat`)

### Task 4.1: `hash.ts` — deterministic hash helpers

- [ ] **Step 1:** Wrap or thin-adapt `@typegpu/noise`'s `randf` API for our needs. Specifically we want `glyphIndex(seed, slotY) -> u32 in [0, GLYPH_COUNT)`. If `randf` exposes a stateless hash that takes two `u32`s, use it directly. Otherwise write a `wangHash2(a, b)` or a small PCG variant in WGSL.
- [ ] **Step 2:** Commit: `feat(m4): hash helpers`

### Task 4.2: Render-glyphs samples the correct atlas layer per cell

- [ ] **Step 1:** Replace the single-quad single-layer M3 logic with: full-screen fragment derives `(columnIdx, slotY)` from `uv`, reads `Column[columnIdx]`, computes `k = floor(headY) - slotY` (cells behind head). If `k < 0 || k > tailLen`: discard. Otherwise: `glyphIdx = hash(seed, slotY) % GLYPH_COUNT`, `sdfSample = sample(atlas, vec3(localUV, glyphIdx))`, `alpha = smoothstep(...)`. Pick brightness via the falloff function.
- [ ] **Step 2:** Implement `falloff(k, tailLen, depth)` analytically. Simple start: `brightness = pow(1 - k / tailLen, 1.5) * (0.3 + 0.7 * depth)`. Tune live with the demo.
- [ ] **Step 3:** **Decision point (per spec §4.1):** pick deterministic monotone-falloff vs probabilistic-flavor (hash-driven brightness bucket per cell). Implement both behind a debug-panel toggle so the difference is visible; pick the keeper before tagging.
- [ ] **Step 4:** Wire the head color: at `k == 0` use `HEAD`; for `k > 0` interpolate `mix(TRAIL, FADE, k / tailLen)`. Multiply by `falloff(...)`.
- [ ] **Step 5:** Commit: `feat(m4): per-cell glyphs from hash(seed, slotY) + analytic falloff`

### Task 4.3: Wire `glyphs-flat` render mode

- [ ] **Step 1:** Render-mode selector now switches to the M4 glyph render for `glyphs-flat`. State-debug rectangle mode stays available for comparison.
- [ ] **Step 2:** Atlas-debug mode can be retired or kept as a hidden diagnostic.
- [ ] **Step 3:** Commit: `feat(demo): glyphs-flat render mode active`

**Chunk 4 verification:**
- [ ] `glyphs-flat` shows columns of falling kana with the canonical Matrix look (head bright, tail fading, every cell a glyph).
- [ ] Switching back to `state-debug` and forward keeps animation coherent (no buffer state corruption).
- [ ] Density / stepRate / fontSize sliders still work; visible effect matches expectations.
- [ ] Color model decision documented in the spec or a code comment.
- [ ] Tag: `git tag 0.4.0`

---

## Chunk 5: Milestone 5 — Parallax (variable speed + depth)

**Purpose:** Per-column speed is randomized at init; `depth` correlates to speed; render dims and slightly blurs slower (= farther) columns. Fake parallax.

**Files:**
- Modify: `src/lib/gpu/render-graph.ts` (init logic)
- Modify: `src/lib/gpu/pipelines/render-glyphs.ts` (depth-dim, slight blur)
- Modify: `src/lib/types.ts` (add `ParallaxOptions`)
- Modify: `src/lib/matrix-rain.tsx` (or scaffold a real component now — pair-coding decision)
- Modify: `src/demo/debug-panel.tsx` (enable parallax toggle + speedRange + depthDim sliders)

### Task 5.1: Per-column speed + depth at init

- [ ] **Step 1:** In `render-graph.ts` column init: `speed = lerp(speedRange[0], speedRange[1], randf.sample())`, `depth = (speed - speedRange[0]) / (speedRange[1] - speedRange[0])`. Frozen for the column's life (per spec §4.1).
- [ ] **Step 2:** Commit: `feat(m5): per-column speed + depth at init`

### Task 5.2: Depth-modulated rendering

- [ ] **Step 1:** In the fragment shader: multiply brightness by `mix(1.0 - depthDim, 1.0, depth)` so depth=0 (slowest) is dimmer. For "blur": cheap approximation — sample the SDF with a slightly larger smoothstep band when `depth` is low, making the glyph soft.
- [ ] **Step 2:** Commit: `feat(m5): depth-modulated brightness + soft glyphs for far columns`

### Task 5.3: Debug-panel controls + wire `glyphs-parallax` render mode

- [ ] **Step 1:** Enable parallax toggle (when off, force all columns to speed=1, depth=1), speedRange dual-slider, depthDim slider.
- [ ] **Step 2:** Wire the `glyphs-parallax` entry in the render-mode selector to enable the parallax shader path (the entry was already added in Chunk 0; this hooks the renderer to it).
- [ ] **Step 3:** Commit: `feat(demo): m5 parallax controls + glyphs-parallax mode`

**Chunk 5 verification:**
- [ ] Columns visibly fall at different speeds.
- [ ] Slower columns are dimmer and slightly softer-edged.
- [ ] Toggling parallax off gives uniform speed/brightness.
- [ ] Tag: `git tag 0.5.0`

---

## Chunk 6: Milestone 6 — Bloom post-process

**Purpose:** Real Gaussian bloom — render the glyph pass to an HDR offscreen target, brightness-extract, separable blur via ping-pong, additive combine over the scene. The biggest visual upgrade over the 2D.

**Files:**
- Create: `src/lib/gpu/pipelines/bloom.ts`
- Modify: `src/lib/gpu/render-graph.ts` (add HDR target + ping-pong bloom textures + lifecycle)
- Modify: `src/demo/debug-panel.tsx` (enable bloom toggle + intensity + threshold)
- Add (probably): import from `@typegpu/color` for linear/sRGB

### Task 6.1: HDR offscreen target + render path change

- [ ] **Step 1:** Create an `rgba16float` texture matching the canvas pixel size. M4's glyph render now draws into this target instead of directly into the swap chain.
- [ ] **Step 2:** Add a passthrough blit shader that copies HDR → swap chain (with linear → sRGB tone-map if needed via `@typegpu/color`). This lets us land the HDR plumbing without bloom logic yet.
- [ ] **Step 3:** Verify visually: no regression vs M5.
- [ ] **Step 4:** Commit: `feat(m6): HDR offscreen target + passthrough blit`

### Task 6.2: Brightness extract pass

- [ ] **Step 1:** New pass reading HDR target; output to a 1/2 or 1/4 resolution texture; fragment: `max(rgb - threshold, 0)`.
- [ ] **Step 2:** Commit: `feat(m6): bloom brightness-extract pass`

### Task 6.3: Separable Gaussian blur (ping-pong)

- [ ] **Step 1:** Create two textures of same size as the extracted-brightness target. Write a horizontal blur shader (9-tap or 13-tap Gaussian); then a vertical blur shader reading the result. Two dispatches per blur; chain 2–4 levels of progressively smaller textures for nicer bloom.
- [ ] **Step 2:** Pair-coding: walk through the kernel weights together. Reference: standard Gaussian σ choice for our pixel radius.
- [ ] **Step 3:** Commit: `feat(m6): separable Gaussian blur (ping-pong)`

### Task 6.4: Additive combine + intensity + wire `glyphs-bloom` render mode

- [ ] **Step 1:** Final bloom pass: sample bloom texture(s), `outColor = hdrSample + intensity * bloomSum`, then blit to swap chain.
- [ ] **Step 2:** Wire the `bloom` toggle, `intensity` and `threshold` sliders in debug panel.
- [ ] **Step 3:** Wire the `glyphs-bloom` entry in the render-mode selector to enable the bloom passes (entry already added in Chunk 0).
- [ ] **Step 4:** Commit: `feat(m6): bloom combine + glyphs-bloom mode + debug controls`

**Chunk 6 verification:**
- [ ] Bright head characters visibly glow into adjacent pixels.
- [ ] `bloom={false}` (toggle) removes the glow entirely; FPS rises measurably.
- [ ] Intensity / threshold sliders have the expected effect.
- [ ] No console errors, no validation errors when toggling.
- [ ] FPS readout — note the cost; compare with M5 baseline.
- [ ] Tag: `git tag 0.6.0`

---

## Chunk 7: Milestone 7 — CRT pass (scanlines + chromatic aberration)

**Purpose:** Final post-process pass adds scanlines and chromatic aberration; produces the CRT/glitchy character of the WebGPU version.

**Files:**
- Create: `src/lib/gpu/pipelines/crt.ts`
- Modify: `src/lib/gpu/render-graph.ts` (CRT pass after bloom combine)
- Modify: `src/demo/debug-panel.tsx` (enable crt toggle + scanlineStrength + aberration)

### Task 7.1: CRT fragment shader

- [ ] **Step 1:** Takes the post-bloom HDR (or tone-mapped LDR) and adds: scanlines `1 - scanlineStrength * (0.5 + 0.5 * sin(uv.y * scanlineFreq))`, chromatic aberration `vec3(sampleR offset, sampleG, sampleB offset)` where offsets are a few px.
- [ ] **Step 2:** Tone-map at the end (use `@typegpu/color` if it offers helpers; otherwise simple Reinhard or no-op for now).
- [ ] **Step 3:** Commit: `feat(m7): CRT pass — scanlines + chromatic aberration`

### Task 7.2: Wire into render-graph as the final pass

- [ ] **Step 1:** When `crt !== false`, CRT replaces the passthrough blit. When `false`, blit unchanged.
- [ ] **Step 2:** Debug-panel controls enabled.
- [ ] **Step 3:** Commit: `feat(demo): m7 CRT controls`

**Chunk 7 verification:**
- [ ] `glyphs-crt` (full pipeline) render mode looks like the "final" Matrix rain.
- [ ] Disabling CRT gives back the cleaner bloom output.
- [ ] Aberration slider produces visible RGB fringing.
- [ ] Scanline slider visibly modulates horizontal bands.
- [ ] FPS stable.
- [ ] Tag: `git tag 0.7.0`

---

## Chunk 8: Milestone 8 — Mouse + scroll interaction

**Purpose:** Cursor position and scroll velocity disturb nearby columns. CPU captures input; uniform write per frame; compute shader applies a force.

**Files:**
- Create: `src/lib/hooks/use-interaction.ts` (capture window mouse + scroll, decay)
- Modify: `src/lib/hooks/use-matrix-rain-renderer.ts` (consume interaction state)
- Modify: `src/lib/gpu/pipelines/compute-step.ts` (apply force)
- Modify: `src/lib/types.ts` (add `InteractionOptions`)
- Modify: `src/demo/debug-panel.tsx` (enable interaction toggle + strength + radius)
- Modify: `src/demo/observability.tsx` (mouse position overlay)

### Task 8.1: Window-level mouse + scroll capture with decay

- [ ] **Step 1:** Hook: subscribes to `window` `mousemove` and `scroll`. Stores last-known px position + scroll velocity. Per-frame decay (e.g. `strength *= exp(-deltaSec * 3)`).
- [ ] **Step 2:** Commit: `feat(m8): interaction capture hook`

### Task 8.2: Uniform write each frame

- [ ] **Step 1:** Convert mouse px → cell coords (CPU-side per spec §4.2). Write into `Uniforms.mousePos`, `Uniforms.mouseStrength`, `Uniforms.scrollVel`.
- [ ] **Step 2:** Commit: `feat(m8): write interaction state to uniforms`

### Task 8.3: Compute shader applies force

- [ ] **Step 1:** For each column near `mousePos.x` (within `radius`), add to its `headY` an extra `mouseStrength * falloff(distance, radius) * deltaStep`. Direction (push down or up) — pair-coding decision; default push down for a "wake" feel.
- [ ] **Step 2:** Scroll velocity uniformly adds to all columns' speed during that step.
- [ ] **Step 3:** Commit: `feat(m8): compute shader applies mouse + scroll force`

### Task 8.4: Demo controls + overlay

- [ ] **Step 1:** Enable interaction toggle, strength + radius sliders. When off, the hook still runs but writes zeros (or we skip wiring it entirely — cheaper).
- [ ] **Step 2:** Observability widget shows current `mousePos` in cell coords as a small overlay.
- [ ] **Step 3:** Commit: `feat(demo): m8 interaction controls + mouse overlay`

**Chunk 8 verification:**
- [ ] Moving the cursor over the canvas visibly disturbs nearby columns.
- [ ] Scrolling the page bursts every column's speed for ~1 sec then decays.
- [ ] Disabling interaction makes the rain ignore the cursor entirely.
- [ ] No jank when the cursor moves rapidly.
- [ ] Tag: `git tag 0.8.0`

---

## Chunk 9: Milestone 9 — `paused` static frame, ResizeObserver, error handling

**Purpose:** Land the lifecycle parity work: settled-snapshot when `paused`, debounced resize that splits width vs height correctly, and the three failure modes wired to `onError`. After this milestone the component is API-complete.

**Files:**
- Modify: `src/lib/matrix-rain.tsx` (formalize the component, props, refs)
- Modify: `src/lib/types.ts` (final props shapes)
- Modify: `src/lib/gpu/render-graph.ts` (resize-split logic, settling helper, dispose audit)
- Modify: `src/lib/hooks/use-matrix-rain-renderer.ts` (paused + error wiring)
- Modify: `src/demo/App.tsx` (paused toggle, drag-handle for canvas size)
- Modify: `src/demo/observability.tsx` (in-page error console: subscribe to `onError`)

### Task 9.1: `paused` static-frame logic

- [ ] **Step 1:** When `paused` flips from false→true: dispatch compute `ceil(canvasHeightInCells / averageSpeed)` times in a tight loop (spec §5.3); run one render pass; unsubscribe from `useFrame`. False→true→false reverses cleanly.
- [ ] **Step 2:** Verify in demo: toggling paused freezes a meaningful frame, not a blank one.
- [ ] **Step 3:** Commit: `feat(m9): paused static-frame logic`

### Task 9.2: ResizeObserver with split-purpose logic

- [ ] **Step 1:** Replace the M0 ResizeObserver with the spec §6.2 diagram: debounce 100ms; recompute pixel size; if pixel-size changed → recreate HDR + bloom textures + reconfigure swap chain; if columnCount changed → recreate column buffer with fresh seeds; else preserve.
- [ ] **Step 2:** Add a drag handle on the canvas's parent container in the demo so the user can resize without resizing the window — verifies the path.
- [ ] **Step 3:** Verify: shrinking the canvas (no column count change) preserves column state; shrinking past a column boundary recreates and animation continues from scratch in the affected columns; growing rapidly doesn't stutter.
- [ ] **Step 4:** Commit: `feat(m9): split-purpose resize logic + drag handle in demo`

### Task 9.3: Error handling — three failure modes

- [ ] **Step 1:** GPU init failure: try/catch around `init()`. On throw → call `onError(err)` → component returns `null` → `console.error` once.
- [ ] **Step 2:** Device lost: subscribe to `root.lost` (via `@typegpu/react`'s API for that). On resolve → call `onError(err)` → `dispose()` → unsubscribe.
- [ ] **Step 3:** Per-frame error: try/catch around the inner of `useFrame`'s callback. On throw → `onError(err)` → unsubscribe.
- [ ] **Step 4:** No automatic retry in any case.
- [ ] **Step 5:** Demo `<Observability />` in-page console: prop `onError` from the renderer pipes here so user doesn't need to open DevTools.
- [ ] **Step 6:** Force a failure to verify (e.g. temporarily reduce a buffer size to invalid → revert after).
- [ ] **Step 7:** Commit: `feat(m9): three-mode error handling wired to onError`

### Task 9.4: Formalize `<MatrixRainWebGPU>` props + exports

- [ ] **Step 1:** Lock the public props per spec §5.2. Final closed list (no other props): `fontSize`, `density`, `stepRate`, `paused`, `bloom`, `crt`, `parallax`, `interaction`, `className`, `onError`. Anything currently held in component-internal `useState` that is in this list moves to controlled props; anything held that is not in this list either becomes internal state forever or is removed.
- [ ] **Step 2:** `src/lib/index.ts` final exports:
  ```ts
  export { MatrixRainWebGPU } from "./matrix-rain";
  export { isWebGPUSupported } from "./feature-detect";
  export type {
    MatrixRainProps,
    BloomOptions,
    CrtOptions,
    ParallaxOptions,
    InteractionOptions,
  } from "./types";
  ```
- [ ] **Step 3:** No `respectReducedMotion`, no `theme`, no IntersectionObserver inside the component (per spec §5.4).
- [ ] **Step 4:** Commit: `feat(m9): formalize <MatrixRainWebGPU> public API`

**Chunk 9 verification:**
- [ ] Paused toggle produces a settled static frame and a resumable animation.
- [ ] Canvas drag-resize behaves per the spec's diagram (width change re-seeds, height-only preserves).
- [ ] Forcing a GPU error shows it in the in-page console and the component renders null cleanly.
- [ ] `pnpm types && pnpm check` clean.
- [ ] Tag: `git tag 0.9.0`

---

## Chunk 10: Milestone 10 — API polish + dependency audit + publish

**Purpose:** Ship `0.10.0` to npm. Configure the package build (`exports`, `types`, `sideEffects`, peer deps), write the README, audit ecosystem dependencies, optionally rename the directory.

**Files:**
- Modify: `package.json` (build config, exports, peer deps, version)
- Create: `vite.config.lib.ts` OR `tsup.config.ts` (decide together)
- Create: `README.md`
- Modify: `src/lib/index.ts` (sanity-check, no internal-leaking exports)

### Task 10.1: Package build setup

- [ ] **Step 1:** Decide between Vite library mode and `tsup` (pair-coding decision; tsup is simpler for pure ESM TS packages). Add the chosen config; outputs to `dist/`.
- [ ] **Step 2:** Update `package.json`:
  ```jsonc
  {
    "name": "matrix-rain-webgpu",
    "version": "0.10.0",
    "type": "module",
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "files": ["dist", "README.md"],
    "sideEffects": false,
    "peerDependencies": {
      "react": "^19",
      "react-dom": "^19",
      "typegpu": "^0.11",
      "@typegpu/react": "^0.11"
    }
  }
  ```
  (`@typegpu/noise` and `@typegpu/color` are likely peer deps too if we end up importing them; finalize during step 10.3.)
- [ ] **Step 3:** Add a `build:lib` script. Verify `pnpm build:lib` produces `dist/index.js` + `.d.ts`.
- [ ] **Step 4:** Commit: `chore(m10): package build setup`

### Task 10.2: README

- [ ] **Step 1:** `README.md` content: what it is, install, usage example (consumer with fallback check), props table, browser support, related: link to the future article.
- [ ] **Step 2:** Commit: `docs(m10): README`

### Task 10.3: Dependency audit (spec §7bis)

- [ ] **Step 1:** Run `npx knip` or just grep `src/lib/` for each `@typegpu/*` import: `noise`, `color`, `sdf`, `radiance-cascades`.
- [ ] **Step 2:** For any not imported: `pnpm remove @typegpu/<pkg>`. Specifically `@typegpu/radiance-cascades` will almost certainly go.
- [ ] **Step 3:** For kept ones, move from `dependencies` to `peerDependencies` if they expose user-visible API surface.
- [ ] **Step 4:** Commit: `chore(m10): dependency audit per spec §7bis`

### Task 10.4 (optional, **run after publish** to avoid session churn): rename directory

- [ ] **Step 1:** If you want the directory to match the package name now, run from the parent: `mv matrix-rain matrix-rain-webgpu`. Re-open the project from the new path — this ends the current Claude session, so do it **after** Task 10.5 (publish) so a session interruption doesn't strand a half-published release.
- [ ] **Step 2:** Update any absolute paths in saved memory files (search/replace `/Code/Fabrizio/matrix-rain` → `/Code/Fabrizio/matrix-rain-webgpu`).

### Task 10.5: Publish

- [ ] **Step 1:** `pnpm build:lib` (or whatever the build script ends up being).
- [ ] **Step 2:** `npm publish --dry-run` → review the file list; ensure no `src/demo` or `docs/` leaks.
- [ ] **Step 3:** `npm publish --access public` (assuming you don't already have a scoped private setup).
- [ ] **Step 4:** Verify on npmjs.com.
- [ ] **Step 5:** Commit, then push tags when a remote is configured: `git push --tags`. (The `0.10.0` tag itself is created in Chunk 10 verification, last step.)

### Task 10.6: Consumability smoke test

- [ ] **Step 1:** In a throwaway directory: `pnpm create vite@latest test-consumer --template react-ts`. `pnpm i matrix-rain-webgpu`. Import `<MatrixRainWebGPU>` in `App.tsx`, render it. Run `pnpm dev`.
- [ ] **Step 2:** Verify it works.
- [ ] **Step 3:** Delete the throwaway directory.

**Chunk 10 verification:**
- [ ] Package builds clean.
- [ ] `dist/` contains only what we want.
- [ ] Throwaway consumer project imports and runs the rain.
- [ ] Tag: `git tag 0.10.0` (matches the version published to npm in Task 10.5)

---

## Post-v1 (out of scope of this plan, sketched for orientation)

- **Article authoring** — compose from per-milestone notes and tags.
- **chicio-blog integration** — refactor `MatrixRain2D` to take `paused`, build wrapper that combines `useReducedMotions` + `useIntersectionPause` + `isWebGPUSupported`, swap rendering in the live site. Spec written when reached.
- **Automated tests** — vitest unit (hash, atlas builder, palette, feature-detect) + one Playwright smoke; CI if judged worth the maintenance.
- **v2 features** — per-character glyph morphing (continuous vs head-only TBD); hidden "Wake up Neo" message; themeable palette.
- **v2 experiment** — `@typegpu/radiance-cascades` adoption to make bright heads cast real soft volumetric light into the dark background. Follow-up article candidate.

---

## Conventions used in this plan

- **Pair-coding default:** Before any non-trivial code change, present the snippet to discuss; let the user drive if they want.
- **Verification:** Every chunk ends with manual demo verification. No `pytest`/`vitest` runs in v1 — this is intentional ([feedback memory](../../../.claude/projects/-Users-fduroni-Code-Fabrizio-matrix-rain/memory/project_testing_deferred.md)).
- **Commits:** Conventional commits (`feat:`, `chore:`, `docs:`, `feat(mN):` for milestone-tagged changes). One commit per task in most cases; smaller commits welcome.
- **Tags:** End-of-milestone tags `0.0.0` through `0.10.0` (one per milestone, semver-shaped so they double as release candidates — see [project-version-tagging](../../../.claude/projects/-Users-fduroni-Code-Fabrizio-matrix-rain/memory/project_version_tagging.md)). The article will link to these tags to walk readers through specific stages.
- **References:** `[[name]]` style for memory links; relative paths for in-repo files.

---

*Plan authored 2026-06-07 alongside the spec at [`../specs/2026-06-07-matrix-rain-webgpu-design.md`](../specs/2026-06-07-matrix-rain-webgpu-design.md).*
