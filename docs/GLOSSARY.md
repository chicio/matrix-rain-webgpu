# Glossary

Alphabetical reference of project-specific terms. Open in parallel with [`docs/DESIGN.md`](DESIGN.md) and the source files in `src/lib/gpu/`.

---

### 8SSEDT

"Sequential Signed Euclidean Distance Transform, 8-direction." The algorithm we use in `build-sdf-atlas.ts` to convert a binary mask (0/1 pixels: outside/inside the glyph) into a distance field. Two raster sweeps (forward top-left→bottom-right, backward bottom-right→top-left); each pixel stores a 2D offset vector `(offsetX, offsetY)` to its nearest source pixel; final per-pixel distance is `sqrt(offsetX² + offsetY²)`. Total cost: O(N²) per glyph, ~5ms for our 64×64 layers. Run twice per glyph (inside-source + outside-source) to combine into signed distance.

### Atlas

The collection of all 48 baked glyph SDFs as a single GPU texture. Concretely: a `r8unorm` 2D-array texture of size `64 × 64 × 48` (width × height × layers). One layer per glyph, indexed by `glyphIndex`.

### Atlas layer

One slice of the atlas texture corresponding to one glyph's SDF. The third axis of the 2D-array texture; passed to `textureSample(...)` as the `arrayIndex` argument.

### Bind group / Bind group layout

WebGPU resource-binding primitives. A **layout** declares which resources a pipeline expects (e.g. "a 2D-array texture + a filtering sampler"); a **group** binds concrete instances to a layout. We use them for textures + samplers (buffers auto-bind via `root.createUniform` / `createMutable`).

### `brightnessJitter`

`src/lib/gpu/hash.ts` — pure function `(seed: u32, slotY: u32) → f32 ∈ [-JITTER_RANGE, +JITTER_RANGE]`. Decorrelated from `glyphIndex` via a `BRIGHTNESS_SALT = 1.7` offset on the slotY input. Multiplied with the deterministic falloff to give organic per-cell brightness variation.

### Cell

One glyph slot in the column grid. Size = `cellSize × cellSize` (in drawing-buffer pixels). Each column is one cell wide; each row is one cell tall.

### Coverage

Canonical graphics term for "how much of this pixel is covered by the shape." In our shader: `coverage = smoothstep(0.5 - edgeHalfBand, 0.5 + edgeHalfBand, sample.x)` ∈ [0, 1]. Used as the blend factor between background and glyph color: `mix(BACKGROUND, glyphColor * brightness, coverage)`.

### Column

One falling drop. State (`headY`, `speed`, `depth`, `tailLength`, `seed`) lives in the per-column entry of the GPU storage buffer. Schema: `Column` in `src/lib/gpu/schemas.ts`. The compute pass updates each column's `headY` per logical step.

### `column.seed`

`u32` per-column identifier. Drives `glyphIndex(seed, row)` for layer selection and `brightnessJitter(seed, row)` for brightness variation. Rotates on respawn (next-seed = `u32(randf.sample() * U32_MAX_F)`).

### Compute pipeline / Compute pass

GPU shader that runs arbitrary code in parallel without rasterization. Used for the per-step column update (advance heads, respawn check). Workgroup size = 64; dispatch count = `ceil(columnCount / 64)`. See `src/lib/gpu/pipelines/compute-step.ts`.

### Density (semantic)

`Uniforms.density` ∈ [0, 1]. Respawn condition: `randf.sample() > density`. **Higher density = fewer respawns per step** (sparser rain). Inverse of the plan text's `randf < density`; locked at M2-T2.2 for 2D parity. At density = 1.0, respawn never fires (`randf` is `[0, 1)`).

### `depth` (per column)

Float ∈ [0, 1]. Derived from `speed` in M5 (faster = closer to viewer = brighter). Modulates `depthDimming = mix(MIN_DEPTH_BRIGHTNESS, 1, depth)` in the render-glyphs fragment. In M2–M4, `depth = 1` for all columns (no parallax yet); the M4 `MIN_DEPTH_BRIGHTNESS = 0.3` constant gets replaced with a uniform-driven slider in M5.

### `depthDimming`

`= mix(MIN_DEPTH_BRIGHTNESS, 1, column.depth)`. A multiplier in [MIN_DEPTH_BRIGHTNESS, 1] that dims slower (= farther) columns. No-op in M4 (depth=1).

### DPR (device pixel ratio)

`window.devicePixelRatio`. On a Retina display, typically 2 or 3 — meaning CSS px × DPR = device px. Our lib operates in drawing-buffer pixels (= device px); the demo passes `cellSize = fontSize * DPR` to do the conversion.

### Drawing-buffer pixels

The canvas's actual pixel count, equal to device pixels for a normally-configured canvas (`useConfigureContext({ autoResize: true })` configures it this way). Distinct from CSS pixels.

### `edgeHalfBand`

Half-width of the smoothstep transition zone around the SDF edge. Computed as `fwidth(localUv.x) * 0.5`. Multiplied by 2 → full smoothstep band ≈ 1 device pixel wide, scaled correctly for any rendering size.

### Falloff

The brightness curve from head to tail end. Currently `tailFalloff = pow(clamp(1 - k/tailLength, 0, 1), 1.5)` — head at k=0 is 1.0; tail end at k=tailLength is 0.0; mid-tail dips faster than linear due to the 1.5 exponent.

### Fragment shader

GPU shader stage that runs once per pixel of the rasterized output. Our render-glyphs fragment is the most complex shader in the codebase — see [`docs/DESIGN.md`](DESIGN.md) "Architecture at a glance" and `src/lib/gpu/pipelines/render-glyphs.ts`.

### `fwidth`

WGSL standard library function. Returns `|dFdx(x)| + |dFdy(x)|` — the screen-space rate of change of `x` between adjacent pixels. We use it to scale `edgeHalfBand` so the AA band stays ~1 device pixel regardless of cell size. Available in fragment shader only.

### Glyph index

The layer of the atlas texture corresponding to a given glyph in the cell. Computed via `glyphIndex(column.seed, row)` in `src/lib/gpu/hash.ts`. Pure function of `(seed, row)`; stable across frames until the column respawns.

### Hash invariant

The property that `glyphIndex(column.seed, row)` is a pure function of its inputs. Consequence: as a column's head advances, every row's glyph stays the same — characters are "etched into space," and the head visually slides past them. Reset only when `column.seed` rotates on respawn. Load-bearing for the film-faithful aesthetic.

### Head

The leading (bottom) cell of a falling column, where `k = 0`. Painted with `PALETTE.head` (bright near-white-green `#B8FFC2`). Stays uniformly bright; the `brightnessJitter` is zeroed at the head so it never dims unexpectedly.

### `headY`

Per-column `f32`. Continuous position of the head in row-units (not pixels). The compute pass advances `headY += speed` per logical step. `floor(headY)` gives the integer row of the head cell.

### `k`

Cells-behind-the-head distance. `k = floor(headY) - row`. `k = 0` is the head row; `k ∈ (0, tailLength]` is the trail; `k < 0` is below the head (empty); `k > tailLength` is above the tail's top (empty).

### `localUv`

Per-pixel coordinate within a single cell. `localUv = (fract(pixelPos.x / cellSize), fract(pixelPos.y / cellSize))` ∈ [0, 1]². The 4th argument to `textureSample` along with the integer glyph layer.

### PALETTE

`{ background, head, trail, fade }` color constants in `src/lib/gpu/palette.ts`. RGBA tuples typed `as const` for readonly 4-element inference. Hard-coded Matrix colors.

### Pixel position (`pixelPos`)

Per-pixel coordinate in drawing-buffer space: `pixelPos = uv * resolution`. From this we derive `col`, `row`, and `localUv`.

### `r8unorm`

WebGPU texture format. Single-channel, 8-bit per pixel, value normalized to `[0, 1]` when sampled. Used for the SDF atlas — each glyph layer is 64×64 = 4096 bytes; 48 layers total = ~196 KB GPU memory.

### `randf`

Stateful PRNG provided by `@typegpu/noise`. Per-thread state in GPU shaders. We use it as a one-shot hash: seed via `randf.seed2(vec2f(...))`, then call `randf.sample()` once for a uniform `f32 ∈ [0, 1)`.

### Render mode

The debug-panel dropdown's value. Current options: `state-debug` (= `glyphs-flat` after M4), `atlas-debug` (one centered glyph), `glyphs-flat`, `glyphs-parallax` / `glyphs-bloom` / `glyphs-crt` (still M1-gradient placeholders awaiting M5/6/7).

### Render-graph

The mid-level abstraction returned by `createRenderGraph(...)` in `src/lib/gpu/render-graph.ts`. Owns all GPU resources for one rain instance: uniforms buffer, columns storage buffer, atlas texture + sampler + bind group, compute pipeline, render-glyphs pipeline, atlas-debug pipeline. Exposes `resize`, `step`, `render`, `dispose`, and tuning setters.

### Respawn

The event where a column's `headY` resets to 0 and `seed` rotates. Triggered in the compute shader when `headY * cellSize > resolution.y` (off-screen) AND `randf.sample() > density` (probabilistic gate).

### Sampler

GPU resource describing texture filtering + addressing. Ours: `magFilter: 'linear'`, `minFilter: 'linear'`, `addressModeU/V: 'clamp-to-edge'`. The linear filter is essential for SDF sampling — it bilinearly interpolates between adjacent texels, giving a continuous distance field at fractional uv.

### SDF

Signed Distance Field. A 2D array where each pixel holds the signed distance to the nearest edge of a shape (negative inside, positive outside, zero on the edge). Our SDFs are encoded as `r8unorm` bytes: `byte = (signedDistance + SPREAD) / (2*SPREAD) * 255`, clamped. Edge sits at byte 127.

### `slotY`

Integer row index of a cell. Synonym for `row` in the fragment shader. Type: `u32`. Used as one input to `glyphIndex(seed, slotY)`.

### Smoothstep

Hermite cubic ease curve: `smoothstep(edge0, edge1, x) = 0` when `x ≤ edge0`, `= 1` when `x ≥ edge1`, smoothly interpolating between with `3t² - 2t³` shape. Used in our fragment to AA the glyph edge: `smoothstep(0.5 - edgeHalfBand, 0.5 + edgeHalfBand, sample.x)`.

### SPREAD

Half-range of the signed-distance encoding, in pixels. We use SPREAD = 8 (so the SDF byte values represent ±8 px from the glyph edge). Defined in `src/lib/gpu/atlas/build-sdf-atlas.ts`.

### `stepProgress`

`f32 ∈ [0, 1)`. Sub-step interpolation fraction = `stepAccumulator / stepInterval` after dispatch. Currently unused by shaders; reserved for future sub-step interpolation if motion blur lands.

### `stepRate`

Simulation steps per second. Default 10 (M4 retuned from M2's 30). Independent of frame rate; the `step()` accumulator may dispatch 0 or more compute passes per frame.

### `tailFalloff`

`= pow(clamp(1 - k/tailLength, 0, 1), FALLOFF_POWER)`. Head-to-tail brightness curve. FALLOFF_POWER = 1.5 (steeper than linear; head pops, dim portion lingers).

### `tailLength`

Per-column number of rows behind the head that get painted. Currently constant `15.0` in M2–M4; M5 will randomize per column.

### `trailJitter`

`= select(brightnessJitter(column.seed, row), 0, k === 0)`. Per-cell ±60% brightness variation; zeroed at the head so heads stay uniformly bright.

### TypeGPU

The typed WebGPU library this project is built on. Provides typed buffer/uniform/texture wrappers (`root.createMutable`, `root.createUniform`, `root.createTexture`), shader authoring helpers (`tgpu.fn`, `tgpu.computeFn`, `tgpu.fragmentFn`), and the `'use gpu'` directive for cross-stage shader code.

### Uniform buffer

Small, read-only-from-shader GPU buffer holding global per-draw data. Our `Uniforms` struct includes `time`, `resolution`, `cellSize`, `density`, `mousePosition`, `mouseStrength`, `scrollVelocity`, `flags`, `atlasLayer`. ~52 bytes total.

### `uv`

`vec2f ∈ [0, 1]²` produced by `common.fullScreenTriangle`. Origin top-left, y-down. Multiplied by `Uniforms.resolution` to get `pixelPos`.

### WGSL

WebGPU Shading Language. TypeGPU transpiles TypeScript with `'use gpu'` directives into WGSL at pipeline-resolve time; we rarely write WGSL directly.

### Workgroup size

GPU compute concept. Threads run in fixed-size blocks; we use `[64]` for column-update compute. Picking a multiple of 32/64 keeps hardware SIMD lanes busy. Total threads per dispatch = `workgroupCount × 64`; the shader bounds-checks and early-returns for threads beyond `columnCount`.
