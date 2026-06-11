# The CRT pass — scanlines, chromatic aberration, tone-map

A deep-dive explainer for the M7 post-process pass (`src/lib/gpu/pipelines/crt.ts`).
Written to be re-read on its own; assumes only that you've seen a fragment shader before.
For where this pass sits in the render graph, see [`DESIGN.md`](DESIGN.md); for terms, see [`GLOSSARY.md`](GLOSSARY.md).

---

## What this pass is

After the glyphs are rendered and bloom is composited, one **final full-screen pass** reads the
finished image and stamps a CRT-monitor character onto it on its way to the screen. It runs once
per pixel of the canvas, sampling the composited scene as an input texture (reusing `blitBindings`
— a single texture + sampler) and outputting the final color.

It does three things, in order:

1. **Chromatic aberration** — pull the colour channels slightly apart, mimicking a lens/beam that
   doesn't focus all wavelengths to the same point.
2. **Tone-map (clamp)** — bring values into the displayable `[0,1]` range.
3. **Scanlines** — darken the image in fine horizontal bands, like a CRT's scan beam.

```
sample (R/G/B pulled apart)  →  clamp to [0,1]  →  multiply by scanline ripple  →  output
```

The whole shader body:

```ts
// 1. chromatic aberration
const offset = d.vec2f(uniforms.$.aberration / uniforms.$.resolution.x, 0);
const r = textureSample(source, sampler, uv + offset).x;
const g = textureSample(source, sampler, uv).y;
const b = textureSample(source, sampler, uv - offset).z;

// 2. tone-map (clamp)
let color = std.saturate(d.vec3f(r, g, b));

// 3. scanlines
const scanFreq = resolution.y * ((2 * Math.PI) / SCANLINE_PERIOD_PX);
const scan = 1 - scanlineStrength * (0.5 + 0.5 * sin(uv.y * scanFreq));
color = color * scan;

return d.vec4f(color, 1);
```

---

## 1. Chromatic aberration

A real lens bends red, green, and blue light by slightly different amounts, so the three colour
channels land in slightly different places — you see coloured fringes at high-contrast edges. We
fake it by sampling the **same** input texture three times at **slightly shifted** positions, and
keeping one channel from each sample:

```ts
const offset = d.vec2f(uniforms.$.aberration / uniforms.$.resolution.x, 0);
const r = textureSample(source, sampler, uv + offset).x;   // red,   shifted right
const g = textureSample(source, sampler, uv).y;            // green, centered
const b = textureSample(source, sampler, uv - offset).z;   // blue,  shifted left
```

### Why divide by `resolution.x`?

`uv` coordinates run `0..1` across the width, but the slider (`aberration`) is in **pixels**. To
convert "N pixels" into uv units you divide by the width in pixels: `N / resolution.x`. So
`aberration = 1` shifts red one pixel right and blue one pixel left, regardless of canvas size.

At `aberration = 0` the offset is zero, all three samples are identical, and you get the original
colour back — no fringing. Larger values widen the red/blue split, most visible on the bright heads.

> **Possible upgrade:** this is a flat horizontal shift. Real CRTs fringe *radially* (more toward
> the edges). Replace the fixed `offset` with one that grows with distance from centre
> (`dir = uv - 0.5`) for a more authentic look.

---

## 2. Tone-map — why we clamp instead of Reinhard

The combined scene can have channel values slightly **above 1.0** (bloom adds glow on top of heads
that are already at full brightness). A display can only show `[0,1]`, so we must map down somehow.

The textbook move is a **tone-map operator** like Reinhard, `x → x/(x+1)`, which gracefully
compresses an unbounded HDR range into `[0,1)`. We tried it — and the image went dark. Here's why:
Reinhard maps a full-brightness head pixel of `1.0` to `1.0/2.0 = 0.5`, **halving** it, and pulls
every midtone down the same way. Reinhard is designed for *true* HDR where bright values are far
above 1.0; our signal mostly lives in `[0,1]` with only a modest overshoot, so the operator just
crushes everything.

So we **clamp** instead — `std.saturate(v)` is `clamp(v, 0, 1)`:

```ts
let color = std.saturate(d.vec3f(r, g, b));
```

Values in `[0,1]` pass through untouched; bloom's `>1.0` highlights simply blow out to white, which
is the look we want for a glow. This is also exactly what happened implicitly pre-M7 (writing `>1`
into an 8-bit swap chain clamps), so the brightness matches the earlier milestones.

> **Possible upgrade:** if we ever make heads *emit* true HDR (values well above 1.0 for a punchier
> glow — a deferred bloom idea), revisit a real tone-map with an exposure/white-point so highlights
> roll off smoothly instead of clipping.

---

## 3. Scanlines — the math in full

This is the subtle one. The goal: darken the image in repeating thin **horizontal** bands.

```ts
const scanFreq = resolution.y * ((2 * Math.PI) / SCANLINE_PERIOD_PX);
const scan     = 1 - scanlineStrength * (0.5 + 0.5 * sin(uv.y * scanFreq));
color          = color * scan;
```

### 3a. Building the `scan` multiplier, inside-out

`scan` is a number we multiply each pixel's colour by. Where `scan = 1` the pixel is untouched
(bright line); where `scan < 1` it's dimmed (dark line).

**Step 1 — a wave.** `sin(...)` oscillates between **−1 and +1**.

**Step 2 — remap to [0,1].** A standard shader idiom:

```
0.5 * sin(x)   → range [−0.5, +0.5]
0.5 + 0.5*sin  → range [ 0.0,  1.0]
```

So `0.5 + 0.5*sin(...)` is a smooth ripple bouncing between 0 and 1.

**Step 3 — scale by the slider.** `scanlineStrength ∈ [0,1]` sets band depth. The term becomes a
ripple over `[0, scanlineStrength]`. At `0` it's flat zero (effect off).

**Step 4 — invert.** `1 - (...)` flips it so the multiplier ranges between:

| ripple value | `scan` | meaning |
|---|---|---|
| 0 | `1.0` | bright line (full brightness) |
| 1 | `1 - scanlineStrength` | dark line (dimmed) |

At `scanlineStrength = 0.3`, every pixel is multiplied by something in **[0.7, 1.0]** — alternating
bright/dim. `color * scan` applies it.

### 3b. The frequency line — what `scanFreq` *is*

This is the line that trips people up:

```ts
const scanFreq = resolution.y * ((2 * Math.PI) / SCANLINE_PERIOD_PX);
```

The single idea: **`sin` eats an angle in radians, and `scanFreq` is the total angle swept from the
top of the screen to the bottom.**

- `sin` completes one full wave every **2π ≈ 6.28 radians** of input, then repeats.
- `uv.y` only runs `0 → 1` top-to-bottom. `sin(uv.y)` alone feeds `sin` less than one radian — a
  fraction of a single wave. Useless; we want *hundreds* of thin bands.
- So we **stretch** `uv.y` into a big angle by multiplying it: `uv.y * scanFreq`. As `uv.y` goes
  `0 → 1`, the angle goes `0 → scanFreq`. That's why `scanFreq` *is* "the total angle, top to
  bottom."

Read the line right-to-left:

```
resolution.y           ×        (2π / SCANLINE_PERIOD_PX)
   │                                   │
   how many pixels tall          angle budget per pixel of height
   └──────────────────────────────────┘
        total angle swept down the screen  =  scanFreq
```

### 3c. Worked example

Canvas 800 px tall (`resolution.y = 800`), `SCANLINE_PERIOD_PX = 4`:

```
scanFreq = 800 * (2π / 4) = 400π ≈ 1256 radians
```

As you scan top→bottom, `sin`'s input runs `0 → 1256`. Number of complete waves:

```
1256 / 2π ≈ 200 waves
```

**200 waves over 800 px = one band every 4 px** — which is exactly `SCANLINE_PERIOD_PX`. (That the
constant equals the real pixel spacing is *why* we use `2π` and set it to `4`; an earlier version
used `π` with `2`, which silently produced 4-px bands from a constant labelled "2".)

### 3d. Why `resolution.y` *must* be a factor

Resize the canvas to 1600 px tall:

```
scanFreq = 1600 * (2π/4) = 800π   →   400 waves over 1600 px   →   still 4 px per band.
```

Because `scanFreq` is *built from* `resolution.y`, the wave count grows in lockstep with the pixel
height, so each band stays a fixed **4 physical pixels** at any size. A hard-coded `scanFreq` would
instead keep a fixed wave *count*, so bands would fatten as the window grew.

### 3e. "Where's the curve?" — why a sine looks like flat stripes

`scan` depends on `uv.y` **only** — never `uv.x`. So every pixel in a single horizontal row shares
the same `scan` value; nothing varies left-to-right. As you move *down*, that shared brightness
rises and falls along the sine. The result is flat horizontal bands.

The sine curve is real, but it lives on a graph of **brightness vs. height**, not on the canvas:

```
brightness
   1.0 │‾\        /‾\        /‾\        /‾        ← sin, plotted against uv.y
       │  \      /   \      /   \      /
   0.7 │   \____/     \____/     \____/
       └─────────────────────────────────► uv.y (top → bottom)
```

To make the 2-D image, take each height's brightness and smear it straight across the whole row.
A curve smeared horizontally becomes stripes — the wiggle is entirely vertical. (To actually *see*
a curve you'd have to make the effect depend on the other axis, e.g. `uv.x + 0.02*sin(uv.y*freq)`,
which bends columns sideways — deliberately *not* what a CRT beam does.)

---

## Parameters at a glance

| Uniform | Slider range | Effect |
|---|---|---|
| `aberration` | 0–5 px | R/B channel split; `0` = none |
| `scanlineStrength` | 0–1 | band depth; `0` = no scanlines, `1` = darkest bands drop to black |

`SCANLINE_PERIOD_PX = 4` (constant) sets band spacing; not exposed as a slider.

## See also

- `src/lib/gpu/pipelines/crt.ts` — the implementation.
- `src/lib/gpu/render-graph.ts` — `render()` shows the composite → final-pass wiring.
- [`DESIGN.md`](DESIGN.md) — the post-process chain (glyphs → HDR → bloom → CRT → swap chain).
