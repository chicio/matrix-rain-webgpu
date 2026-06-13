# chicio-blog WebGPU Integration (SP-A) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **All work is in the `chicio-blog` repo** (`/Users/fduroni/Code/Fabrizio/chicio-blog`), on a branch, delivered as a **draft PR** (Mode B). **No unit-test framework** — verification is tsc + lint + `next build` + manual + the Vercel preview (per the spec).

**Goal:** Make chicio-blog's `MatrixRain` an orchestrator that renders the published `matrix-rain-webgpu` (full showcase) when WebGPU is available and falls back to the existing 2D canvas otherwise, with offscreen + reduced-motion pausing shared across both.

**Architecture:** Client-gated pick (detect once on mount → WebGPU or 2D, `onError` runtime safety net). The 2D impl is extracted to `Matrix2DCanvas` (driven by a `paused` prop); a `useMatrixRainActivity` hook computes `paused = useReducedMotions() || !onScreen` and feeds both renderers. The public `MatrixRain` name + `{fontSize, density}` shape are preserved so all four call sites (2 molecules + `/404` + `/offline`) are untouched.

**Tech Stack:** Next.js 16 (app router), React 19.2, TypeScript 5, npm; `matrix-rain-webgpu@beta` + peers `typegpu`/`@typegpu/react`/`@typegpu/noise`.

**Spec:** `planning/superpowers/specs/2026-06-13-chicio-blog-webgpu-integration-design.md` (in the matrix-rain repo).

---

## File Structure (all in chicio-blog)

- **Create** `src/components/design-system/atoms/effects/matrix-2d-canvas.tsx` — `Matrix2DCanvas`, today's 2D logic moved here, driven by a `paused` prop (no internal observer / reduced-motion).
- **Create** `src/components/design-system/atoms/effects/use-matrix-rain-activity.ts` — `useMatrixRainActivity(ref)` → `paused` boolean.
- **Rewrite** `src/components/design-system/atoms/effects/matrix-rain.tsx` — orchestrator `MatrixRain` (client-gated pick).
- **Modify** `package.json` — add the lib + 3 peers.
- **Untouched:** both molecules, `not-found.tsx`, `offline/page.tsx` (they keep importing `MatrixRain`).

---

## Chunk 1: Deps + 2D extraction

### Task 0: Branch + draft PR
- [ ] **Step 1:** In chicio-blog, from a clean default branch: `git checkout -b feat/matrix-rain-webgpu`
- [ ] **Step 2:** Push and open a draft PR:
```bash
git push -u origin feat/matrix-rain-webgpu
gh pr create --draft --title "feat: WebGPU matrix rain with 2D fallback" \
  --body "Integrates matrix-rain-webgpu@beta as the background with the existing 2D canvas as fallback. Spec in the matrix-rain repo. Draft: validate on the Vercel preview (incl. mobile); merge after the lib's device-loss fix lands."
```

### Task 1: Add dependencies
**Files:** `package.json`
- [ ] **Step 1:** Install the lib (beta tag) + peers:
```bash
npm i matrix-rain-webgpu@beta typegpu @typegpu/react @typegpu/noise
```
- [ ] **Step 2:** Verify the version resolved to the published beta:
```bash
npm ls matrix-rain-webgpu
```
Expected: `matrix-rain-webgpu@1.0.0-beta.1` (or later beta).
- [ ] **Step 3:** Smoke-check the package imports + the build resolves it. Create a throwaway check then delete it:
```bash
node --input-type=module -e "import('matrix-rain-webgpu').then(m=>console.log(Object.keys(m)))" 2>&1 | head
```
Expected: lists `MatrixRainWebGPU`, `isWebGPUSupported` (ESM import resolves). If it errors on ESM/`'use gpu'`, STOP — that contradicts the lib's plugin-less guarantee; report.
- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "build: add matrix-rain-webgpu@beta + typegpu peers"
```

### Task 2: Extract `Matrix2DCanvas`
**Files:** Create `src/components/design-system/atoms/effects/matrix-2d-canvas.tsx`

Move the **entire** current 2D implementation from `matrix-rain.tsx` (the `matrix`/`colors`/`backgroundColor` consts, `setCanvasSize`/`initializeDrops`/`initialize` helpers, and the renderer) into this new file, with these changes:
- Public props become `{ fontSize: number; density: number; paused: boolean }`. **Drop** `frameRate` from the props but keep an internal `const FRAME_RATE = 20`. **Remove** the `useReducedMotions` import and the `observe`/`IntersectionObserver` logic + `isVisible` state (these move to the hook/orchestrator).
- Keep `"use client"`, the `canvasRef`, the `lastWidth` ref + the `resize` debounce/re-init, and the exact `<canvas className="pointer-events-none absolute top-0 left-0 block h-full w-full" />`.
- **Paused behavior** (the real refactor). Use refs so toggling doesn't re-randomize the field:
  - `pausedRef` synced to `paused` every render.
  - `rafRef` holds the current `requestAnimationFrame` id.
  - Main effect `[fontSize, density]`: `initialize(...)`, draw one **settle burst** (`for (i<FRAME_RATE) drawFrame()`) so a populated frame shows immediately, attach the resize listener, then `if (!pausedRef.current) start the rAF loop`. Cleanup: `cancelAnimationFrame(rafRef.current)` + remove the listener.
  - Pause effect `[paused]`: `paused` → `cancelAnimationFrame(rafRef.current)` (freeze, last frame stays); `!paused` → (re)start the loop if not already running. The `frame`/`drawFrame`/`renderingLoop` closures are defined in the main effect; expose start/stop via refs so the pause effect can call them.
- `export const Matrix2DCanvas = memo(...)`.

- [ ] **Step 1:** Create the file with the above.
- [ ] **Step 2:** Typecheck: `npx tsc --noEmit` (or chicio-blog's `npm run` typecheck script — check `package.json`). Expected: clean.
- [ ] **Step 3:** Lint: chicio-blog's lint script (e.g. `npm run lint`). Expected: clean.
- [ ] **Step 4: Commit**
```bash
git add src/components/design-system/atoms/effects/matrix-2d-canvas.tsx
git commit -m "refactor: extract Matrix2DCanvas (paused-prop driven)"
```

---

## Chunk 2: Activity hook + orchestrator + verification

### Task 3: `useMatrixRainActivity` hook
**Files:** Create `src/components/design-system/atoms/effects/use-matrix-rain-activity.ts`

- [ ] **Step 1:** Implement: `"use client"`; `useMatrixRainActivity(ref: RefObject<HTMLElement | null>): boolean`.
  - Reuse the existing `useReducedMotions()` (same import the old atom used) for `reducedMotion`.
  - `onScreen` state via `IntersectionObserver` on `ref.current` with the **existing** options
    `{ root: null, rootMargin: "-50px 0px -50px 0px", threshold: 0 }`, mirroring the old
    `observe()` (treat `entry.isIntersecting || entry.intersectionRect.height > 0` as on-screen).
    Default `onScreen = true` (so SSR/first paint is "active"); update in the observer.
  - Return `reducedMotion || !onScreen`.
  - **Hydration invariant:** no `window`/`navigator` access during render; observer set up in `useEffect`.
- [ ] **Step 2:** Typecheck + lint. Expected: clean.
- [ ] **Step 3: Commit**
```bash
git add src/components/design-system/atoms/effects/use-matrix-rain-activity.ts
git commit -m "feat: useMatrixRainActivity (offscreen + reduced-motion pause source)"
```

### Task 4: Orchestrator `MatrixRain`
**Files:** Rewrite `src/components/design-system/atoms/effects/matrix-rain.tsx`

- [ ] **Step 1:** Replace the file contents with the orchestrator:
  - `"use client"`. Props `{ fontSize?: number; density?: number }` with the current defaults (`fontSize = 16`, `density = 0.95` — match the old atom's defaults).
  - A wrapping `<div ref={containerRef} className="absolute top-0 left-0 w-full h-full">` (or the minimal wrapper needed to host the canvas + be observed) carrying the matrix dark background via inline style / class so the detection gap isn't blank. Reuse the 2D `backgroundColor` value for consistency.
  - `const paused = useMatrixRainActivity(containerRef);`
  - `const [mode, setMode] = useState<'pending' | 'webgpu' | 'fallback'>('pending');` (literal initial — hydration invariant).
  - `useEffect(() => { setMode(isWebGPUSupported() ? 'webgpu' : 'fallback'); }, []);`
  - Render:
    - `pending` → just the backdrop div.
    - `webgpu` → `<MatrixRainWebGPU rain={{ fontSize, density }} paused={paused} onError={() => setMode('fallback')} />` inside the div.
    - `fallback` → `<Matrix2DCanvas fontSize={fontSize} density={density} paused={paused} />` inside the div.
  - `export const MatrixRain = memo(...)`. Keep the export name + shape identical so the 4 call sites are untouched.
- [ ] **Step 2:** Typecheck + lint. Expected: clean. Confirm no call site changed (`git status` shows only the 3 effect files + package.json).
- [ ] **Step 3: Commit**
```bash
git add src/components/design-system/atoms/effects/matrix-rain.tsx
git commit -m "feat: MatrixRain orchestrator — WebGPU with 2D fallback"
```

### Task 5: Verification + delivery
- [ ] **Step 1:** `next build` (chicio-blog's `npm run build`). Expected: succeeds; the lib resolves with no TypeGPU-plugin config. If it fails on the package's ESM, add `transpilePackages: ['matrix-rain-webgpu']` to `next.config` and note it.
- [ ] **Step 2:** `next dev` — manually verify the **four** surfaces show WebGPU rain (full showcase): `MatrixBackground` (a page that uses it), `MatrixHeaderBackground`, `/404`, `/offline`.
- [ ] **Step 3:** Force the 2D path (temporarily make the orchestrator's effect `setMode('fallback')`, or use a WebGPU-disabled browser) and confirm identical layout/sizing on each surface; revert the temp change.
- [ ] **Step 4:** Paused parity: scroll a surface offscreen (freezes); toggle the **site's motion setting** and/or emulate a low-end profile (DevTools `hardwareConcurrency<=2` / Save-Data) → static settled frame. Confirm WebGPU and a forced-2D run behave the same.
- [ ] **Step 5:** Push; leave the PR **draft**. Comment with what was verified locally and that the Vercel preview is the cross-device/mobile gate (WebGPU on capable phones + real 2D fallback on those without it).
```bash
git push
gh pr comment --body "Implemented + locally verified (4 surfaces, forced-2D fallback, paused parity). Vercel preview is the device/mobile gate. Holding draft until the lib's device-loss fix ships."
```

---

## Done criteria
- All four surfaces render WebGPU rain on a capable browser; forced-2D path is layout-identical.
- Paused parity holds (offscreen freeze + reduced-motion static) for both renderers.
- `next build` + tsc + lint clean; no TypeGPU plugin needed in Next config.
- Only the 3 effect files + `package.json` changed; call sites untouched.
- Draft PR up, Vercel preview reachable for device testing.

## Follow-ups (not this plan)
- Merge to prod after the lib's **device-loss fix** lands (so the site doesn't inherit the sleep/resume black-screen) + maintainer review.
- Graduate `matrix-rain-webgpu` to `1.0.0` and repoint chicio-blog off `@beta`.
- Optional `forceFallback` prop if `/404`/`/offline` should stay light (deferred).
