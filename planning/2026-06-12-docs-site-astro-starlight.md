# Docs + Demo Site (Astro + Starlight) Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Project verification rule (overrides TDD default):** This repo ships **no test framework in v1** (see memory `project_testing_deferred`). "Verify" everywhere below means: `npm run types` (tsc) + `npm run check` (oxlint + oxfmt) clean, the relevant build succeeds (`vite build` or `astro build`), and a **visual eyeball** in the browser. There are no `*.test.ts` files to write.
>
> **Authoring rule (load-bearing):** The **current source code is the single source of truth.** The superpowers plan/spec (`docs/superpowers/`) and the agent memory describe *intended* design that has since diverged (grouped API, cut interaction, atlas-debug moved to the demo, trimmed `Uniforms`, no `parallax.enabled`, tuned defaults, flattened structure). Use them only for *rationale/history*; **fact-check every claim against the code before writing it.**

**Goal:** Turn the project into an Astro + Starlight documentation website that hosts the live demo as its landing experience, with rich markdown docs (architecture, per-component CG+math deep-dives, hand-written public API, glossary, WebGPU primer), while keeping the npm package publishable independently.

**Architecture:** Two packages in one repo. The **root** is the pristine, publishable library (`src/`, flattened — no more `src/lib/`); its `package.json` carries only lib + Astro-free metadata and publishes `dist/`. The **`docs/`** folder is a self-contained **Astro + Starlight** app (own `package.json`) that imports the library source and demo components via relative paths, runs `unplugin-typegpu` in its own Vite config, renders the public `<MatrixRainWebGPU>` on the hero (dogfooding the public API) and the internal demo `App` on `/playground` (manual testing). GitHub Pages keeps deploying via Actions, now building the `docs/` app.

**Tech Stack:** Astro, Starlight (`@astrojs/starlight`), `@astrojs/react` (React 19 islands, `client:only="react"` for WebGPU), `unplugin-typegpu` (Vite) + `@vitejs/plugin-react`, KaTeX (`remark-math` + `rehype-katex`), Mermaid (`rehype-mermaid` or `astro-mermaid`), Pagefind (Starlight built-in search). Library unchanged: TypeGPU + WebGPU + React, oxlint/oxfmt.

**`tsover` mechanism (do not mis-state):** the project's `'use gpu'` typechecking comes from aliasing TypeScript to `tsover` — wired in root `package.json` as `"typescript": "npm:tsover@6.0.1"` in BOTH `devDependencies` AND a top-level `overrides` block (plus `pnpm.overrides`). It is **not** a `tsconfig` field. For `docs/` to typecheck `'use gpu'` islands it needs the same `devDependencies.typescript` alias + `overrides` in `docs/package.json`. Also: the root typecheck (`npm run types` = `tsc -b`) is driven by **project references** — deleting `vite.config.ts` (Chunk 4) breaks `tsconfig.node.json`'s `include`, so that reference must be removed/retargeted in the same step.

**Sequencing note:** Docs-first. Publishing `0.10.0` happens **after** the API page + How-it-works pages settle the public surface — it is tracked in the existing `docs/superpowers/plans/2026-06-07-matrix-rain-webgpu-implementation.md` (Chunk 10), not duplicated here. This plan ends at a complete, deployed docs+demo site.

---

## File Structure (target)

```
/                                  ← publishable library package (root)
├── package.json                   (lib only, NO Astro. The publishable shape — exports, files:["dist"], deps→peerDeps, lib build — is produced by the SEPARATE publish plan, not this one; here we only keep it Astro-free + the types/check/fix scripts)
├── tsconfig*.json                 (lib typecheck via project references; tsover override stays; the vite.config.ts reference in tsconfig.node.json is removed in Chunk 4)
├── .nvmrc, .oxlintrc, etc.
├── src/                           ← FLATTENED library (was src/lib/)
│   ├── index.ts                   (public exports)
│   ├── matrix-rain.tsx            (MatrixRainWebGPU)
│   ├── types.ts
│   ├── hooks/use-matrix-rain-renderer.ts   (used by the public component AND the demo)
│   └── gpu/
│       ├── feature-detect.ts
│       ├── render-graph.ts
│       ├── atlas/ · material/ · pipelines/ · schemas/
├── dist/                          (lib build output for npm — gitignored)
├── planning/                      ← transient: this plan + relocated superpowers plans/specs (deleted once docs are rich)
└── docs/                          ← Astro + Starlight app (own package)
    ├── package.json               (astro, @astrojs/starlight, @astrojs/react, react, react-dom, unplugin-typegpu, remark-math, rehype-katex, rehype-mermaid)
    ├── astro.config.mjs           (Starlight integration + sidebar; vite.plugins=[typegpu()]; vite.server.fs.allow=['..']; markdown remark/rehype plugins)
    ├── tsconfig.json              (extends root or replicates tsover for the island)
    ├── public/                    (favicon etc., moved from src/demo/public)
    └── src/
        ├── pages/
        │   ├── index.astro        (HERO: <MatrixRainWebGPU> public component as bg + CTAs)
        │   └── playground.astro   (full demo App island)
        ├── components/            (React islands + Astro wrappers)
        │   ├── HeroRain.tsx       (thin wrapper around the public <MatrixRainWebGPU>)
        │   └── demo/              (moved internal demo: App, debug-panel/*, hooks/*, atlas-debug-pipeline)
        └── content/
            └── docs/              (Starlight content collection — the markdown/MDX)
                ├── overview/{introduction,webgpu-primer,getting-started}.md(x)
                ├── usage/{public-api,recipes}.mdx
                ├── architecture/{pipeline-overview,data-model}.mdx
                ├── how-it-works/{column-simulation,sdf-atlas,glyph-rendering,parallax,bloom,crt}.mdx
                └── glossary.md
```

**Decision recap (from the grilling session, all locked):** Astro+Starlight; two-package repo; flatten `src/lib`→`src/`; site in `docs/`; keep Actions deploy; hero = public component, `/playground` = internal demo; Mermaid diagrams; KaTeX math; hand-written API page; Pagefind search; matrix-green theme; source-is-truth authoring; site canonical (blog links in later); docs-first then publish.

---

## Chunk 1: Scaffold the Astro + Starlight app in `docs/`

**Goal:** A Starlight site builds and serves locally with a placeholder home + one docs page. No library/demo wiring yet. The existing Vite demo at root keeps working untouched in parallel during this chunk.

**Files:**
- Create: `docs/package.json`, `docs/astro.config.mjs`, `docs/tsconfig.json`
- Create: `docs/src/content.config.ts` (or `content/config.ts` per Starlight version), `docs/src/content/docs/index.mdx` (temp), `docs/src/content/docs/overview/introduction.md` (stub)
- Create: `docs/.gitignore` (`dist/`, `.astro/`, `node_modules/`)
- Move (pre-step): existing `docs/DESIGN.md`, `docs/GLOSSARY.md`, `docs/crt-pass.md`, `docs/superpowers/` out of `docs/`

- [ ] **Step 0: Clear `docs/` first.** `docs/` is currently NON-EMPTY (`DESIGN.md`, `GLOSSARY.md`, `crt-pass.md`, `superpowers/`) and `npm create astro` into a non-empty dir fails. Relocate them now: `git mv docs/superpowers planning/superpowers`; `mkdir -p planning/seed-docs && git mv docs/DESIGN.md docs/GLOSSARY.md docs/crt-pass.md planning/seed-docs/`. (These are *seed material* for the content chunks; Chunk 5's relocate step is now redundant — done here.) Commit this move on its own.
- [ ] **Step 1: Create the `docs/` Astro+Starlight project.** From repo root, with `docs/` now empty: `npm create astro@latest docs -- --template starlight --no-install --no-git --skip-houston`. Confirm it scaffolds `docs/astro.config.mjs`, `docs/src/content/`, `docs/package.json`. (If the CLI flags differ in the current Astro version, scaffold into a temp dir and move files into `docs/`.)
- [ ] **Step 2: Pin the toolchain.** Edit `docs/package.json`: ensure `react`/`react-dom` are `^19` to match the root; add scripts `dev`/`build`/`preview` (Astro defaults). Do NOT add the library as a dependency — it's imported by relative path.
- [ ] **Step 3: Install.** `cd docs && npm install`. Verify `node_modules/` created. **Commit `docs/package-lock.json`** (the `.gitignore` ignores `node_modules`/`dist`/`.astro` but NOT the lockfile) — CI's `npm --prefix docs ci` requires it.
- [ ] **Step 4: Minimal Starlight config.** In `docs/astro.config.mjs`, set `site`/`base` to match Pages (`base: '/matrix-rain-webgpu/'`), title `matrix-rain-webgpu`, and a placeholder `sidebar`. Leave React/typegpu/math/mermaid for later chunks.
- [ ] **Step 5: Verify dev + build.** `cd docs && npm run dev` → open the placeholder Starlight site (eyeball). Then `npm run build` → expect `docs/dist/` produced, no errors.
- [ ] **Step 6: Commit.**
```bash
git add docs/ && git commit -m "feat(docs): scaffold Astro + Starlight site in docs/"
```

**Chunk 1 verification:** `cd docs && npm run build` succeeds; dev server shows the Starlight shell with the placeholder page.

---

## Chunk 2: React islands + `unplugin-typegpu`; hero renders the public component

**Goal:** Prove the hard technical path works — an Astro page renders a React island that imports the **public** `<MatrixRainWebGPU>` from the library source, with `'use gpu'` code transformed by `unplugin-typegpu`, client-only (no SSR).

**Files:**
- Modify: `docs/astro.config.mjs` (add `@astrojs/react`; `vite: { plugins: [typegpu()], server: { fs: { allow: ['..'] } } }`)
- Modify: `docs/package.json` (add `@astrojs/react`, `unplugin-typegpu`, `@vitejs/plugin-react` if needed)
- Create: `docs/src/components/HeroRain.tsx` (imports `MatrixRainWebGPU` from the lib source)
- Create/Modify: `docs/src/pages/index.astro` (custom hero page, NOT a Starlight content page)

- [ ] **Step 1: Add React + typegpu plugins.** `cd docs && npx astro add react` (accept config edits). Then `npm i -D unplugin-typegpu` and edit `astro.config.mjs`:
```js
import typegpu from 'unplugin-typegpu/vite';
// inside defineConfig({...}):
vite: { plugins: [typegpu({})], server: { fs: { allow: ['..'] } } },
```
`fs.allow: ['..']` lets Vite import library source from outside `docs/`. **Known risk (verify, don't assume):** `unplugin-typegpu` is a *Babel* transform that the root Vite app runs alongside `@vitejs/plugin-react`. `@astrojs/react` manages React's Vite/Babel pipeline internally, so a bare `typegpu()` in `vite.plugins` may not compose with the island transform the way it does standalone. The Chunk-2 success criterion is therefore **not** "plugin registered" but "**`'use gpu'` is actually transformed inside an `@astrojs/react` island and the rain renders**". If it doesn't compose, fall back options: pass typegpu's Babel plugin via `@astrojs/react`'s `babel` option, or build the demo island through a small standalone Vite step and import the bundle.
- [ ] **Step 2: Path alias for the library.** In `astro.config.mjs` `vite.resolve.alias`, add `{ '@lib': fileURLToPath(new URL('../src/lib', import.meta.url)) }` — **`../src/lib` is the CURRENT location** (pre-flatten). Islands import `@lib/...`. Chunk 4 retargets this alias to `../src` after the flatten, so nothing else changes.
- [ ] **Step 3: Hero island.** `docs/src/components/HeroRain.tsx`:
```tsx
import { MatrixRainWebGPU } from '@lib'; // resolves to src/index.ts
export function HeroRain() {
  return <MatrixRainWebGPU />; // defaults; canvas fills its positioned parent
}
```
- [ ] **Step 4: Hero page.** `docs/src/pages/index.astro` — a full-bleed landing: a positioned container holding `<HeroRain client:only="react" />` as the background, with title + CTA links to `/playground`, `getting started`, and docs. `client:only="react"` is REQUIRED — WebGPU has no SSR.
- [ ] **Step 5: Verify.** `cd docs && npm run dev` → home shows the live rain (defaults: bloom + CRT) behind the hero text. Confirm: no SSR errors, no `'use gpu'` transform errors in the console, rain animates. Then `npm run build` succeeds.
- [ ] **Step 6: Typecheck.** Ensure the island typechecks against the lib. For `'use gpu'` types, replicate the **`tsover` package.json mechanism** in `docs/package.json`: add `"typescript": "npm:tsover@6.0.1"` to `devDependencies` AND a top-level `"overrides": { "typescript": "npm:tsover@6.0.1" }` (mirroring root) — NOT a tsconfig field. Re-install. Run `cd docs && npx astro check` — expect clean.
- [ ] **Step 7: Commit.**
```bash
git add docs/ && git commit -m "feat(docs): React islands + unplugin-typegpu; hero renders public MatrixRainWebGPU"
```

**Chunk 2 verification:** Home page shows the live WebGPU rain via the **public component**; `astro build` succeeds. This is the riskiest integration — if it works, the rest is mostly content.

**If it fails:** the likely culprits are (a) `'use gpu'` not transformed → confirm `typegpu()` is in `vite.plugins` and the lib files are within `fs.allow`; (b) SSR crash → confirm `client:only="react"` (not `client:load`); (c) React version mismatch between `docs/` and root → align both at `^19`.

---

## Chunk 3: Migrate the internal demo → `/playground`

**Goal:** The full manual-testing UI (debug panel, observability, atlas-debug) runs at `/playground`, sourced from the existing demo components, now living under `docs/`.

**Files:**
- Move: `src/demo/components/*` → `docs/src/components/demo/*` (App, debug-panel/*)
- Move: `src/demo/hooks/*` → `docs/src/components/demo/hooks/*` (use-atlas-debug-renderer)
- Move: `src/demo/atlas-debug-pipeline.ts` → `docs/src/components/demo/atlas-debug-pipeline.ts`
- Move: `src/demo/demo.css` → `docs/src/components/demo/demo.css` (or `docs/src/styles/`)
- Create: `docs/src/pages/playground.astro`
- (Defer deleting `src/demo/index.html`, `src/demo/main.tsx`, root `vite.config.ts` to Chunk 4.)

> **Expected breakage (not a regression):** the root Vite demo (`root: "src/demo"`) stops working the moment its sources move out in Step 1 — it is *superseded* by `/playground`. Chunk 1's "root demo keeps working in parallel" promise only holds through Chunk 2. From here on, `/playground` is the demo; the dead root Vite entry is formally removed in Chunk 4.

- [ ] **Step 1: Move demo sources** into `docs/src/components/demo/` (use `git mv` to preserve history). Keep their internal relative imports intact; only the imports that reached into the library (`../../lib/...`, `../lib/...`) need rewriting to the `@lib` alias / new path.
- [ ] **Step 2: Rewrite library imports** in the moved demo files to `@lib/...` (e.g. `@lib/hooks/use-matrix-rain-renderer`, `@lib/gpu/atlas/bindings`, `@lib/gpu/material/palette`). The demo legitimately uses internals — these resolve to library *source*, not the package entry, which is fine.
- [ ] **Step 3: Playground page.** `docs/src/pages/playground.astro` renders `<App client:only="react" />` full-screen. Import `demo.css` (via the island or the page). This must reproduce today's demo exactly (canvas + debug rail + observability + atlas-debug mode).
- [ ] **Step 4: Verify.** `cd docs && npm run dev` → `/playground` shows the rain with the working debug panel; sliders, regenerate, paused, bloom/crt toggles, and the atlas-debug render mode all work; observability shows FPS/size/columns. `npm run build` succeeds.
- [ ] **Step 5: Commit.**
```bash
git add -A && git commit -m "feat(docs): migrate internal demo to /playground"
```

**Chunk 3 verification:** `/playground` is feature-identical to the pre-migration demo (manual eyeball of every control + atlas-debug mode).

---

## Chunk 4: Retire the old Vite app; flatten `src/lib` → `src/`; rewire deploy

**Goal:** Remove the now-dead root Vite demo entry, collapse the library to `src/`, and make CI build the `docs/` app.

**Files:**
- Delete: `src/demo/` (now empty/migrated), `src/main.tsx` already gone, `index.html`/`src/demo/index.html`, root `vite.config.ts`
- Move: every `src/lib/*` → `src/*` (`git mv`)
- Modify: every intra-library import (`./gpu/...` stays relative within `src/`; nothing should reference `lib/` after this)
- Modify: root `tsconfig*.json` (paths/rootDir if they mention `lib`), root `package.json` (drop demo/Vite-app scripts; keep `types`/`check`/`fix`; add the lib build script placeholder for Chunk 10/publish)
- Modify: `.github/workflows/deploy.yml`
- Modify: `docs/astro.config.mjs` alias `@lib` → `../src`

- [ ] **Step 1: Delete the retired Vite entry.** Remove `src/demo/` remnants, root `vite.config.ts`, and any root `index.html`/`main.tsx`. Confirm nothing else imports them.
- [ ] **Step 2: Flatten the library.** `git mv src/lib/index.ts src/index.ts`, `git mv src/lib/matrix-rain.tsx src/matrix-rain.tsx`, `git mv src/lib/types.ts src/types.ts`, `git mv src/lib/hooks src/hooks`, `git mv src/lib/gpu src/gpu`. Remove the empty `src/lib/`.
- [ ] **Step 3: Fix imports.** Library-internal imports are already relative (`./gpu/...`, `../schemas/column`, etc.) and survive the flatten unchanged *except* any that referenced `lib`. Grep to confirm: `grep -rn "/lib/\|'\.\./lib\|lib/gpu" src/ docs/` → expect zero. Update the `docs/` `@lib` alias to point at `../src`.
- [ ] **Step 4: Root config.** Update root `tsconfig` `include`/`rootDir` to `src` (drop `src/lib`, `src/demo`). **Remove the `vite.config.ts` reference**: `tsconfig.node.json` (a project reference under `tsc -b`) currently `include`s `vite.config.ts`, which Step 1 deletes — so drop that reference from the root `tsconfig.json` `references` and delete/empty `tsconfig.node.json`, or `npm run types` will fail. Update root `package.json`: remove `dev`/`preview` (Vite-app) scripts; keep `types`, `check`, `fix`; `build` stays `tsc -b` for typecheck (the real **library** build for npm is defined by the separate publish plan). The root no longer has a runnable app — that's the `docs/` site's job.
- [ ] **Step 5: Rewire deploy.** Edit `.github/workflows/deploy.yml` `build` job:
  - Install both packages: `npm ci` (root) and `npm --prefix docs ci` (requires the committed `docs/package-lock.json` from Chunk 1).
  - Quality gate stays: `npm run types` + `npm run check` (root).
  - Build the site: `npm --prefix docs run build`. **`base` is set in `astro.config.mjs` (Chunk 1 Step 4) — `astro build` has NO `--base` CLI flag** (unlike the old `vite build --base=…` line, which is removed). Do not pass `--base`.
  - `upload-pages-artifact` `path: docs/dist`.
- [ ] **Step 6: Verify locally.** Root: `npm run types && npm run check` clean. `docs`: `npm run build` succeeds and `/` + `/playground` render. Grep confirms no `lib/` references remain.
- [ ] **Step 7: Commit.**
```bash
git add -A && git commit -m "refactor: retire root Vite app, flatten src/lib→src, build docs site in CI"
```
- [ ] **Step 8: Verify CI.** Push the branch; confirm the `deploy.yml` `build` job passes and (on main) the Pages deploy publishes the new site at the project URL. Eyeball the live `/` and `/playground`.

**Chunk 4 verification:** Local builds green; CI builds the `docs/` app and deploys; live site shows hero + playground. The published-library `package.json` contains zero Astro references.

---

## Chunk 5: Relocate planning artifacts; seed docs; enable math/mermaid/theme

**Goal:** Move internal planning out of `docs/`, wire KaTeX + Mermaid + theme, and seed the Starlight sidebar/IA so content authoring can begin.

**Files:**
- Move: `docs/superpowers/` → `planning/superpowers/` (the existing plan + spec; transient)
- Modify: `docs/astro.config.mjs` (sidebar IA; `markdown.remarkPlugins=[remarkMath]`, `rehypePlugins=[rehypeKatex, rehypeMermaid]`; KaTeX CSS; theme/brand colors)
- Modify: `docs/package.json` (`remark-math`, `rehype-katex`, `rehype-mermaid`)
- Create: empty stub pages for every IA node so the sidebar renders.

- [ ] **Step 1: Confirm planning relocation (done in Chunk 1 Step 0).** `superpowers/` → `planning/superpowers/` and `DESIGN.md`/`GLOSSARY.md`/`crt-pass.md` → `planning/seed-docs/` already happened in Chunk 1 Step 0 (had to, so the Astro scaffold targeted an empty `docs/`). Here just confirm the Starlight content collection globs ONLY `docs/src/content/docs/` and never `planning/`. The seed `.md` get rewritten into content pages in Chunks 8–10.
- [ ] **Step 2: Math.** `npm i -D remark-math rehype-katex` in `docs/`; add to `astro.config.mjs` `markdown` config; import KaTeX CSS globally (Starlight `customCss`). Verify a test `$E=mc^2$` and a display block render.
- [ ] **Step 3: Mermaid.** Add `rehype-mermaid` (or `astro-mermaid`) — verify a ```mermaid flowchart renders to SVG at build time. (Check the current recommended Mermaid-in-Astro approach; APIs shift.)
- [ ] **Step 4: Sidebar IA.** In `astro.config.mjs` `starlight({ sidebar: [...] })`, define the four groups (Overview, Usage, Architecture, How it works) + Glossary, matching the file tree. Add a top-nav link to `/playground`.
- [ ] **Step 5: Theme.** Set Starlight brand/accent to matrix green via `customCss` (CSS custom props). Keep it light — refine in Chunk 10.
- [ ] **Step 6: Stub pages.** Create empty frontmatter-only `.md(x)` for each IA node so the sidebar fully renders and links resolve.
- [ ] **Step 7: Verify + commit.** `cd docs && npm run build` clean; sidebar shows the full IA; math + a sample Mermaid diagram render.
```bash
git add -A && git commit -m "chore(docs): relocate planning, enable KaTeX+Mermaid, seed IA + theme"
```

**Chunk 5 verification:** Full sidebar renders with empty pages; KaTeX + Mermaid + matrix theme working; `planning/` excluded from the build.

---

## Chunks 6–10: Author the content (source-fact-checked)

> **Per-page authoring loop (apply to every content page below).** Content pages aren't TDD-able; this 5-step loop replaces the test cycle:
> - [ ] **a. Read the actual source** for the topic (the exact files named in each page). Note the *real* API/behavior — do not trust the plan/spec/memory.
> - [ ] **b. Draft the page** in MDX: concept → CG/math (KaTeX) → a **real code snippet** (import the source range where the Astro/Expressive-Code setup allows; else paste a verified excerpt) → a **link to the source file** → how it connects to neighbors (Mermaid where useful).
> - [ ] **c. Build:** `cd docs && npm run build` — must succeed (catches MDX/import/math errors).
> - [ ] **d. Eyeball:** dev server — math renders, diagrams render, snippets highlight, links resolve.
> - [ ] **e. Commit** one page (or a small group) per commit: `git commit -m "docs(content): <page>"`.

### Chunk 6: Overview
- [ ] `overview/introduction.md` — what it is; the 2D→WebGPU story; goals (study CG/WebGPU, replace the 2D effect, publish a package); browser support + the `isWebGPUSupported` fallback path. Fact-check the public component name/behavior against `src/matrix-rain.tsx`.
- [ ] `overview/webgpu-primer.mdx` — generic WebGPU background for newcomers: adapter/device, the **uniform vs storage buffer** distinction (tie to `src/gpu/schemas/`), bind groups, render vs compute passes, WGSL/TGSL + the `'use gpu'` directive, the swap chain. Keep it general but ground each concept in where the project uses it.
- [ ] `overview/getting-started.mdx` — install + minimal usage + fallback. **Mark install as provisional until `0.10.0` is published** (a callout); finalize the `npm i matrix-rain-webgpu` snippet post-publish.

### Chunk 7: Usage
- [ ] `usage/public-api.mdx` — **hand-written** reference from `src/types.ts`: `MatrixRainProps` with the `rain` / `parallax` / `crt` / `bloom` groups (+ `paused`, `className`, `onError`), a **defaults table** (from the component's `DEFAULTS`), and the `Options | false` disable convention. Verify field names/defaults against `src/types.ts` + `src/matrix-rain.tsx` (NOT spec §5.2, which is stale).
- [ ] `usage/recipes.mdx` — composing `paused` from reduced-motion/offscreen; sizing the canvas via its positioned parent; disabling effects (`bloom={false}` etc.); using `onError`.

### Chunk 8: Architecture
- [ ] `architecture/pipeline-overview.mdx` — the sim→render flow and the **pass chain** (glyphs→HDR→bloom extract/blur/blur/combine→CRT/blit→swap chain) as a **Mermaid** diagram. Trace it against `src/gpu/render-graph.ts` `render()`.
- [ ] `architecture/data-model.mdx` — `Column` storage buffer vs `Uniforms` uniform buffer; the **particle-system framing**; what the compute pass mutates. Verify against `src/gpu/schemas/{column,uniforms}.ts` + `src/gpu/pipelines/compute-step.ts`.

### Chunk 9: How it works (the deep dives — CG concept + math + snippet + file link)
- [ ] `how-it-works/column-simulation.mdx` — compute pass: respawn, `density` semantics (`randf > density`), speed/depth, seed reroll. Source: `src/gpu/pipelines/compute-step.ts`.
- [ ] `how-it-works/sdf-atlas.mdx` — signed distance fields; the **8SSEDT** distance transform (math); `r8unorm` 2D-array texture; baking. Source: `src/gpu/atlas/build-sdf-atlas.ts`, `glyph-set.ts`.
- [ ] `how-it-works/glyph-rendering.mdx` — SDF sampling; **smoothstep AA via `fwidth`** (the `aaWidth = fwidth(uv)*0.5` derivation — math); per-cell glyph selection via `hash(seed,row)`; brightness falloff + jitter. Source: `src/gpu/pipelines/render-glyphs.ts`, `src/gpu/material/hash.ts`.
- [ ] `how-it-works/parallax.mdx` — depth from speed-spread; `depthDim` brightness; far-softness. Note there is **no `enabled`** flag (value-encoded disable). Source: `render-graph.ts` `initialColumns`, `src/gpu/pipelines/render-glyphs.ts`.
- [ ] `how-it-works/bloom.mdx` — bright extract by threshold; **separable Gaussian blur** (math, why two 1D passes); half-res HDR targets; combine. Source: `src/gpu/pipelines/bloom.ts`.
- [ ] `how-it-works/crt.mdx` — chromatic aberration, scanlines, tone-map (the **clamp-vs-Reinhard** lesson). Largely reuse `crt-pass.md` seed, fact-checked. Source: `src/gpu/pipelines/crt.ts`.

### Chunk 10: Glossary + polish
- [ ] `glossary.md` — from the `GLOSSARY.md` seed, expanded with terms introduced across the pages (SDF, 8SSEDT, fwidth, storage/uniform buffer, bloom, tone-map, DPR, TGSL/`'use gpu'`, particle system, …).
- [ ] Cross-link pages (each How-it-works page links its neighbors + the architecture diagram).
- [ ] Polish pass: theme, social card/OG image, 404, nav order, mobile check.
- [ ] Final eyeball of the whole site + `npm run build` clean; commit.
- [ ] **Handoff to publish:** the API surface is now fully documented and settled → proceed to the existing implementation plan's **Chunk 10 (publish `0.10.0`)**; then return to finalize `getting-started.mdx` install instructions against the published package, and the eventual blog article links here.

---

## Risks & notes
- **`unplugin-typegpu` inside Astro** is the central risk — Chunk 2 de-risks it before any content work. If it can't transform `'use gpu'` in the island, escalate (options: a small Vite sub-build for the demo, or a `tgpu` build step).
- **`tsover` for the island:** the demo/lib use the TypeScript override for `'use gpu'` typechecking. The `docs/` package likely needs the same override to typecheck the island; replicate the root `package.json` `overrides` + `tsconfig` in `docs/` (Chunk 2 step 6 / Chunk 5).
- **Two `package.json`s, two `node_modules`:** CI must `npm ci` both. Local dev runs from `docs/`.
- **Mermaid/KaTeX plugin APIs drift** — verify against current Astro/Starlight docs at implementation time rather than trusting exact package names here.
- **No tests** — the safety net is `tsc` + oxlint + oxfmt + `astro build` + visual review at every step.
