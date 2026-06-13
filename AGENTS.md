# AGENTS.md

Guidance for AI agents working in this repository. `CLAUDE.md` points here. Follow this file;
the **Working contract** and the **rules marked (HARD)** are not optional.

## What this is

`matrix-rain-webgpu` — a React + WebGPU/TypeGPU "digital rain" background effect, published to
npm. It is also a computer-graphics study/refresher project: relearning CG techniques
(signed-distance-field text, separable blur, distance transforms, post-processing) and the
TypeGPU/WebGPU API in a real, shipped artifact. That intent shapes how we work (below).

Two packages in one repo:
- **root** — the publishable library (`src/`).
- **`docs/`** — an Astro + Starlight site (its own `package.json`) hosting the live demo +
  full documentation. It imports the **lib source** (`@lib` → `../src`), not the built package.

## Working contract (HARD)

There are **two modes**, chosen by which part of the codebase a task touches:

- **Mode A — pair programming (core library / computer-graphics code).** Shaders, the render
  graph, pipelines, schemas, the WebGPU/TypeGPU mechanics — anything in `src/gpu/` plus the
  renderer hook. **The human writes the code; the agent guides** (explain the concept, the
  WebGPU/CG reasoning, and what to type; suggest, don't pre-empt; review after). Work in the
  smallest sensible steps. This is the learning core — do not autonomously implement it.
- **Mode B — architect / developer (everything else).** Docs, build, release, CI, repo config,
  the chicio-blog integration glue. **The human architects and decides; the agent writes** the
  implementation in a branch/PR for review and merge. Move faster here.

When unsure which mode a task is in: is it CG/lib mechanics? → Mode A. Otherwise → Mode B.

## Commands

Library (root):
- `npm run check` — oxlint + oxfmt (the quality gate).
- `npm run fix` — oxlint --fix + oxfmt (autofix).
- `npm run types` — `tsc -b` typecheck.
- `npm run build` — Vite library build + `tsc` declarations → `dist/`.
- `npm run release` — release-it (see `RELEASE.md`; runs from CI, not locally — except the
  one-time bootstrap).

Docs site (run from `docs/`, e.g. `npm --prefix docs run dev`):
- `dev` — local dev server (imports lib source, hot-reloads lib edits).
- `build` — production build. `check` — `astro check`.

**There is no unit-test framework.** "Verified" means: `npm run types` +
`npm run check` + a successful `npm run build` + `npm --prefix docs run build` + manual
eyeballing in a real WebGPU browser. Do not add vitest/Playwright without asking. Never claim
"clean/passing" without running the actual command — eslint/oxlint alone miss
module-resolution and type errors that the build catches.

## Architecture (big picture)

The library renders entirely on the GPU. The pipeline, per frame (`src/gpu/render-graph.ts`
orchestrates it):

1. **Compute step** (`pipelines/compute-step.ts`) advances the column simulation on the GPU
   (per-column state lives in a buffer; `schemas/column.ts`).
2. **Glyph render** (`pipelines/render-glyphs.ts`) samples a baked **SDF atlas** per cell into
   a full-res HDR target. Glyph identity is a pure hash of (column seed, row) —
   `material/hash.ts` — so characters are spatially anchored, not scrolling.
3. **Bloom** (`pipelines/bloom.ts`) — extract → separable blur → combine.
4. **CRT** (`pipelines/crt.ts`) or a plain **blit** (`pipelines/blit.ts`) writes the composite
   to the swap chain.

The **SDF atlas** is baked once on mount (`atlas/build-sdf-atlas.ts`, an 8SSEDT distance
transform). Shaders are authored in TypeGPU **TGSL** and **pre-transformed at build time** by
`unplugin-typegpu`, so the published package needs **no** build plugin in the consumer.

Two entry points share the render path through `hooks/use-matrix-rain-renderer.ts`:
- **`src/matrix-rain.tsx`** — the public `<MatrixRainWebGPU>` component (`useRootWithStatus`,
  graceful null + `onError` on init failure). Exported from `index.ts`.
- **`docs/src/components/demo/`** — the internal playground demo (its own `useRoot()` + debug
  panel). Not shipped.

`react`, `react-dom`, `typegpu`, `@typegpu/react`, `@typegpu/noise` are **peerDependencies** —
they must resolve to a single instance in the consumer (duplicate `typegpu`/`react` instances
break the `'use gpu'` registry / React hooks). Keep them peers.

## Code style (HARD)

- **Always brace control flow.** No single-line `if`/`for`/`while` without braces — never
  `if (x) doThing();`. Use `if (x) {\n  doThing();\n}`.
- **No verbose or filler comments.** Match the surrounding density. Comment only the
  non-obvious *why* (a WebGPU gotcha, a deviation, a load-bearing invariant). Delete comments
  that restate the code.
- **React best practices.** Follow the `vercel-react-best-practices` skill (see **Skills**
  below). Check new/changed components against it.
- **No suppressing lint/type errors.** Do not silence a rule with `eslint-disable` /
  `@ts-ignore` / `@ts-expect-error` to make it pass — solve the underlying problem (e.g.
  `useSyncExternalStore` for client-only detection instead of setState-in-effect). If a
  suppression is genuinely unavoidable, surface it explicitly as a decision, never bury it.
- **Conventional Commits.** `feat:` / `fix:` / `feat!:`(or `BREAKING CHANGE:`) drive the
  version + changelog; `docs:`/`chore:`/`refactor:`/`build:`/`ci:` don't release. Commit
  messages decide the release, so write them deliberately.

## Documentation sync (HARD)

The `docs/` Starlight site is the public documentation. **Any change that alters something the
docs describe must update the docs in the same change** — new docs for new capability, edits to
existing pages when behavior changes. Keep these in sync:

- **Public API / exposed components, props, exports change** → `docs/src/content/docs/usage/public-api.md`
  (+ `usage/recipes.md` and the root `README.md` install/usage).
- **Render pipeline / data model change** → `architecture/pipeline-overview.md`,
  `architecture/data-model.md` (and the Mermaid diagram if the flow changed).
- **A technique changes** (bloom, CRT, parallax, SDF atlas, column simulation, glyph
  rendering) → the matching `how-it-works/<topic>.md` (these carry KaTeX math — keep it
  correct).
- **New capability** → add a page and wire it into the sidebar in `docs/astro.config.mjs`.
- New domain terms → `glossary.md`.

If a change touches code the docs explain but you can't update the docs in the same pass, say
so explicitly — don't let them drift.

## Skills

Skills live in **`.agents/skills/`** (the agents.md format, shared across tools — not
`.claude/skills/`), managed by the `skills` CLI and pinned in `skills-lock.json`. Add or update
with `npx skills add <source> --skill <name> -a universal --copy`. Current:
- **`typegpu`** — TypeGPU/WebGPU references (`references/*.md`). Read the relevant file
  on-demand during Mode-A CG work (shaders, pipelines, textures, noise, SDF, matrices).
- **`vercel-react-best-practices`** — React/Next performance rules. Follow it and check
  React code against it.

## Release

CI-driven via release-it + OIDC trusted publishing (tokenless, with provenance). Full runbook
in `RELEASE.md`. Source of truth for "what's done / what's next" lives in the agent's project
memory, not here.
