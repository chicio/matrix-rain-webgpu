# Design: chicio-blog WebGPU matrix-rain integration (SP-A)

**Date:** 2026-06-13
**Status:** Draft for review
**Repo:** `chicio-blog` (the consumer). The library `matrix-rain-webgpu` is published
(`1.0.0-beta.1`); this is the real-world validation that doubles as the shipped feature.

## 1. Goal & context

Validate `matrix-rain-webgpu@beta` in a real Next.js app and, in the same stroke, ship the
WebGPU rain as chicio-blog's production background with the existing 2D canvas as a graceful
fallback. This realises the "website fallback" arm of the project objective.

chicio-blog: **Next.js 16, React 19.2** (matches the lib's `^19` peer), TypeScript 5, npm.
The 2D `MatrixRain` atom (`src/components/design-system/atoms/effects/matrix-rain.tsx`,
exporting `MatrixRain`) has **four** consumers, each passing only `fontSize`/`density`:
- `molecules/effects/matrix-background.tsx` — full-screen background (`MatrixBackground`).
- `molecules/effects/matrix-header-background.tsx` — header strip (`MatrixHeaderBackground`,
  `fontSize=14`).
- `src/app/not-found.tsx` — directly, `fontSize=14 density=0.975`.
- `src/app/offline/page.tsx` — directly, `fontSize=14 density=0.975`.

Because the orchestrator keeps the public name `MatrixRain` and the `{fontSize, density}`
shape, **all four surfaces inherit WebGPU+fallback automatically** with no edits to the call
sites. Treatment is deliberately uniform: the orchestrator's fallback already covers
no-WebGPU/low-end devices, the lib is bundled regardless, and WebGPU needs no network (so
`/offline` works). Revisit only if we later want error pages to force the light 2D path (a
`forceFallback` prop would be the lever).

Key technical fact that shapes the design: **both renderers are client-only `<canvas>`** (the
2D atom draws in `useEffect`; the WebGPU one needs `navigator.gpu`). Neither paints during
SSR, so the design concern is the brief client-side detection gap, not SSR content — a CSS
background colour on the container covers it.

## 2. Success criteria

Production-ready replacement: WebGPU rain on **all four surfaces** (both molecules + `/404` +
`/offline`) with full behavioural parity (paused on offscreen + the site's reduced-motion
signal), the 2D path as a real fallback, SSR-safe, shipped after validation. Delivered as a
draft PR consuming `@beta`; merges as the actual feature.

## 3. Visual treatment

**Full showcase** — the WebGPU version uses the package defaults (bloom + CRT + parallax). It
is intentionally richer than the flat 2D; fallback users get the flat 2D (graceful
degradation). The orchestrator passes only `rain={{ fontSize, density }}` and lets
`bloom`/`crt`/`parallax` default on.

## 4. Component structure

- **`atoms/effects/matrix-rain.tsx` → the orchestrator `MatrixRain`** (`"use client"`). Keeps
  the public name and the `{ fontSize?, density? }` prop shape, so **both molecules are
  untouched**.
- **`atoms/effects/matrix-2d-canvas.tsx` → `Matrix2DCanvas`** — today's 2D implementation
  moved out (same glyphs, colours, draw loop), refactored to accept a `paused` prop (see §6)
  instead of owning its own visibility/reduced-motion logic. **Not "verbatim"** — it's a real
  refactor to a paused state machine; see §6. Preserve the internal `frameRate = 20` default
  (no consumer passes it) and the `resize`/`lastWidth` re-init on window-width change. This is
  the fallback renderer.
- **`atoms/effects/use-matrix-rain-activity.ts` → `useMatrixRainActivity(ref)`** — single
  source of pause truth: `paused = reducedMotion || !onScreen`. Lifts the IntersectionObserver
  (preserving the existing `rootMargin: "-50px 0px -50px 0px"`) out of the 2D atom, and reuses
  the **existing `useReducedMotions()` composite** — which is the site's localStorage motion
  toggle (`useMotionStore`, reactive via `motionChangeEvent`, default `true`) **OR** a low-end
  heuristic (`useDeviceCapabilities`: `deviceMemory<=2 || cores<=2 || saveData`). It is **not**
  OS `prefers-reduced-motion` / `matchMedia`. Both renderers share this one signal.

Each unit has one job: orchestrator = pick + wire; `Matrix2DCanvas` = draw 2D when told;
hook = decide paused. Boundaries are the props (`fontSize`/`density`/`paused`) and the ref.

## 5. Fallback / detection flow (approach ②: client-gated pick)

Orchestrator state `mode: 'pending' | 'webgpu' | 'fallback'`:
1. Render a container `<div>` carrying the matrix dark background via CSS (covers the gap).
2. `useEffect` on mount → `setMode(isWebGPUSupported() ? 'webgpu' : 'fallback')`
   (`isWebGPUSupported` is imported from the lib; only called client-side).
3. `mode === 'webgpu'` →
   `<MatrixRainWebGPU rain={{ fontSize, density }} paused={paused} onError={() => setMode('fallback')} />`.
4. `mode === 'fallback'` → `<Matrix2DCanvas fontSize={fontSize} density={density} paused={paused} />`.
5. `mode === 'pending'` → just the CSS backdrop (one tick).

`onError` is the runtime safety net: `isWebGPUSupported()` only tests `navigator.gpu`
**presence** (it does not request an adapter), so "present but no usable adapter"
(common on Linux / old GPUs) is caught by the lib's async init firing `onError` → flip to 2D.
`onError` can also fire **post-paint** (a per-frame throw after successful init), causing a
visible WebGPU→2D pop mid-session — accepted. Verified against the lib: on init failure
`MatrixRainWebGPU` renders `null` (no dead canvas left behind), so flipping `mode` cleanly
unmounts it and mounts `Matrix2DCanvas`. No 2D→WebGPU swap on the happy path; only one
renderer ever mounts.

**Hydration invariant:** initial `mode` is the literal `'pending'` (never lazily initialised
from `isWebGPUSupported()`); **no `window`/`navigator` access during render** — all capability
detection runs in effects. The server and first client paint both emit the `'pending'`
backdrop, so there is no hydration mismatch. (`useReducedMotions` is already SSR-safe via
`useSyncExternalStore` server snapshots.)

## 6. Paused / visibility / reduced-motion parity

`useMatrixRainActivity` computes `paused = reducedMotion || !onScreen` in the orchestrator and
feeds **both** renderers, so they pause identically by construction. `reducedMotion` is the
site's `useReducedMotions()` signal (motion toggle OR low-end), **not** OS reduce-motion (§4).
- WebGPU: `paused` prop (freezes the sim on a settled static frame — the lib's M9 behaviour).
- 2D `Matrix2DCanvas` paused **state machine** (this is the real refactor of the entangled
  current logic, not a verbatim move):
  - **mount with `paused=true`** → run the synchronous N-frame settle burst once
    (`frameRate` iterations of `drawFrame`, the current reduced-motion behaviour) and do **not**
    start rAF — leaves a populated static frame.
  - **`paused` flips `true→false`** → start the rAF loop.
  - **`paused` flips `false→true`** → `cancelAnimationFrame`, leaving the last frame on screen.
  - The current atom only ever drew the burst when reduced-motion was known at mount; the
    `paused` prop can toggle, so these resume/freeze transitions are **new** semantics the old
    code lacked. The draw effect's resize/`lastWidth` re-init must be preserved across them.

This is what makes "paused behaves the same as the old one" true rather than hoped.

## 7. Dependencies & Next.js integration

- Add to chicio-blog `package.json`: `matrix-rain-webgpu@^1.0.0-beta.1` (or `@beta`) +
  peers `typegpu`, `@typegpu/react`, `@typegpu/noise` (`react`/`react-dom` already present).
- **No Next config or build plugin needed** — shaders ship pre-compiled. Risk/fallback only:
  if Next 16 trips on the package's ESM, add `transpilePackages: ['matrix-rain-webgpu']` to
  `next.config`. Not a planned change; revisit only if a build error demands it.
- Orchestrator + WebGPU component are `"use client"` (already the convention for the 2D atom).
  Detection runs post-mount; `navigator.gpu`/`isWebGPUSupported` never touched on the server.

## 8. Verification & delivery

No unit-test framework (matches the project policy + chicio-blog's decorative usage). Gates:
- **Local:** `next dev` — confirm WebGPU rain on **all four surfaces**: `MatrixBackground`
  (full-page), `MatrixHeaderBackground` (strip), `/404` (`not-found`), and `/offline`. Force
  the 2D path (temporary `isWebGPUSupported`→false or a WebGPU-disabled browser) and confirm
  identical layout/sizing on each. Verify paused parity by (a) scrolling the surface offscreen
  and (b) toggling the **site's motion setting** (the in-app toggle backed by
  `motionChangeEvent`) and/or testing a low-end profile (DevTools `hardwareConcurrency<=2` /
  Save-Data) — **not** the OS reduce-motion media query. Run chicio-blog's own typecheck + lint.
- **Vercel preview (per-PR):** the draft PR's preview deployment is the real cross-device gate
  — test WebGPU on capable phones (iOS Safari 17.4+, Android Chrome) **and** the genuine 2D
  fallback on devices/browsers without WebGPU. This is higher-fidelity than faking detection
  on localhost and is the primary mobile validation.
- **Delivery:** draft PR in chicio-blog consuming `@beta`. It becomes the shipped feature
  after (a) the library's device-loss recovery fix lands (so the prod site doesn't inherit the
  sleep/resume black-screen) and (b) maintainer review. Graduating the lib to `1.0.0` and
  repointing the PR off `@beta` happens then.

## 9. Out of scope / follow-ups

- The library's **device-loss recovery** fix (separate work; the probe is shipped, fix pending
  the overnight sleep test). chicio-blog picks it up via `@beta` automatically.
- Graduating `matrix-rain-webgpu` to `1.0.0` and repointing chicio-blog from `@beta`.
- Any redesign of the 2D visuals — `Matrix2DCanvas` is extracted verbatim, only its
  pause source changes.
