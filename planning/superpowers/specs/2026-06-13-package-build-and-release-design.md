# Design: matrix-rain-webgpu — package build & release automation

**Date:** 2026-06-13
**Status:** Draft for review
**Scope:** the `matrix-rain-webgpu` repo only. Build system (SP-B), release automation
(SP-C), the versioning scheme, and a `RELEASING.md`. The chicio-blog validation harness
(SP-A — `Matrix2DCanvas` extraction + WebGPU/fallback orchestrator + paused parity) is a
**separate, later spec** in the chicio-blog repo, brainstormed after `1.0.0-beta.0` ships.

## 1. Goal & context

The library is feature-complete and documented (live Starlight site). What remains before
real use is making it **installable from npm** and **releasable repeatably**. The driving
constraint from the maintainer: the easiest, most compatible, modern publish path that
matches this project's existing stack.

The package is then validated by consuming it from chicio-blog (its original home, a Next.js
app) — but that validation consumes a **real published beta**, not a local artifact, so each
iteration produces a changelog entry documenting what it fixed.

## 2. Phase sequence

1. **SP-B — build system** (Vite library mode; pre-transformed shaders; exports/peerDeps).
2. **SP-C — release automation** (release-it + conventional-changelog, run from a GitHub
   Actions workflow with **OIDC trusted publishing**, tokenless).
3. **Bootstrap publish `1.0.0-beta.0` locally** — the one-time manual publish that creates
   the package on npm (OIDC cannot do a first publish), then configure trusted publishing.
4. **SP-A (separate spec)** — validate in chicio-blog against the published beta; iterate
   `beta.1`, `beta.2`… via the CI workflow (now tokenless) as fixes land.
5. **Graduate to `1.0.0`** once chicio-blog confirms it and the device-loss fix lands.
6. Repoint the chicio-blog PR from `@beta` → `1.0.0`.

## 3. SP-B — build system

### Bundler & output
- **Vite library mode** + `vite-plugin-dts` for `.d.ts` emission.
- Rationale: `unplugin-typegpu` is **already proven on this exact code** in the docs Vite
  config. The TGSL shader transform is the only real risk in the build; Vite is where we
  know it works. tsup/esbuild could do it via unplugin's esbuild flavour, but that path is
  unvalidated here. "Match the stack + minimise the unknown" both point to Vite.
- **ESM-only** output. Modern React 19 + TypeGPU component lib; Next.js app-router (the
  validation consumer) imports ESM natively. Dual ESM/CJS is a fallback only if a real
  consumer trips on it — not carried speculatively.
- `exports` map sealed to the single public entry (`index.ts`); deep-imports into internals
  blocked.
- `package.json`: flip `private: true` → publishable; add `files`, `exports`, `types`,
  `sideEffects` as appropriate.

### Critical requirement — pre-transformed shaders
`unplugin-typegpu` must run at **lib build time** so the published JS contains the TGSL
shaders already transformed. Consumers (chicio-blog, anyone) must need **zero** TypeGPU
build plugins. This is the single highest-risk item and gets a **verification spike before
anything else**: build → inspect `dist/` → confirm no raw `'use gpu'` directives survive and
a plugin-less consumer runs it.

### Dependencies
- **peerDependencies: `react`, `react-dom`, `typegpu`, `@typegpu/react`.** This is the
  direct fix for the duplicate-instance bug class already hit (commit `91bc083`: two
  `typegpu` copies broke the `'use gpu'` registry; two `react` copies broke the hooks
  dispatcher). There is **one** singleton — `typegpu` — and `@typegpu/react` is a satellite
  that peer-depends on it; peers force a single resolved instance in the consumer.
- **`@typegpu/noise`** — used only for `randf` in `compute-step.ts` and `hash.ts` (pure
  TGSL). Its final classification is decided by the shader-transform spike:
  - If the transform **inlines** its generated WGSL → `@typegpu/noise` becomes
    **build-time-only (devDependency)**, not shipped. Most likely outcome.
  - If it survives to runtime → **peerDependency** (it itself peer-depends on `typegpu`,
    and it was in the `91bc083` dedupe list).
- **Already removed** (commit `a4d92da`, unused): `@typegpu/color`, `@typegpu/sdf`,
  `@typegpu/radiance-cascades`.
- **Correction to the earlier M10 note:** it planned to drop `vite` / `@vitejs/plugin-react`
  / `unplugin-typegpu` as dead devDeps. Building the lib *with* Vite makes those **required
  build devDeps** — they stay.

## 4. SP-C — release automation

Mirrors chicio-blog's release-it setup, adapted for a published package and run from CI.

### `.release-it.json`
```json
{
  "$schema": "https://unpkg.com/release-it/schema/release-it.json",
  "github": { "release": true, "web": true },
  "npm": { "publish": true },
  "hooks": { "before:init": "npm run build" },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "conventionalcommits",
      "infile": "CHANGELOG.md"
    }
  }
}
```
- DevDeps: `release-it` + `@release-it/conventional-changelog` (match chicio-blog's pins).
- Script: `"release": "release-it"`.
- The conventional-changelog plugin does **both** the version bump (feat→minor, fix→patch,
  `feat!`/`BREAKING CHANGE`→major) and the `CHANGELOG.md` write, from the conventional
  commits already in use. release-it then commits, tags, pushes, and creates the GitHub
  release with the changelog as its body.

### `.github/workflows/release.yml`
```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      increment:
        description: "beta | major-beta | patch | minor | major"
        type: choice
        options: [beta, major-beta, patch, minor, major]
        default: beta
      dry_run:
        type: boolean
        default: false
permissions:
  contents: write      # push the bump/changelog commit + tag, create the GH release
  id-token: write      # OIDC token for trusted publishing (+ automatic provenance)
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }                      # full history for changelog diffing
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install -g npm@latest                # trusted publishing needs npm >= 11.5.1
      - run: npm ci
      - run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - run: npx release-it <mapped-args> ${{ inputs.dry_run && '--dry-run' || '' }} --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # No NPM_TOKEN — OIDC trusted publishing authenticates the publish.
```

### Why CI + trusted publishing (the modern payoff)
**OIDC trusted publishing** eliminates long-lived npm tokens: with `id-token: write`, the
workflow exchanges a short-lived OIDC token for publish auth — nothing secret is stored in
the repo. npm itself steers CI/CD here (the Automation-token UI now warns against tokens).
As a free side-effect, **provenance is automatic** — the npm CLI generates and publishes a
signed attestation (Sigstore transparency log) tying the tarball to the exact commit +
workflow, and the package page shows "Built and signed on GitHub Actions". No `--provenance`
flag needed. Requirements: `id-token: write` and **npm ≥ 11.5.1** (hence the npm upgrade
step — Node 22 ships an older npm).

### `workflow_dispatch` increment → release-it args (finalised in implementation)
- `major-beta` → `release-it major --preRelease=beta`  (the `1.0.0-beta.0` jump)
- `beta`       → `release-it --preRelease=beta`         (`1.0.0-beta.1`, `.2`, …)
- `patch`/`minor`/`major` → graduate / normal releases
- `dry_run: true` → append `--dry-run` (used for the first end-to-end test, publishes nothing)

### Bootstrap + trusted-publishing setup (maintainer account actions)
npm trusted publishing **cannot perform a package's first publish** — npmjs.com requires the
package to exist before a trusted publisher can be configured for it (unlike PyPI; see
npm/cli#8544). So:
1. **One-time local bootstrap:** run release-it locally to publish `1.0.0-beta.0` using your
   authenticated npm session (2FA OTP prompt). This creates the package. **No long-lived
   token is created.**
2. **Configure trusted publishing** in the now-existing package's settings on npmjs.com,
   linking it to this repo's `release.yml` workflow.
3. Every subsequent release runs through CI tokenless via OIDC.
- `GITHUB_TOKEN` — auto-provided by Actions; release-it uses it for the GH release. **No
  `NPM_TOKEN` secret is needed.**
- Note (npm policy): trusted-publisher configs created after 2026-05-20 require explicitly
  selecting at least one allowed action (select "publish").

### Caveats on record
- release-it pushes the version-bump + `CHANGELOG.md` commit to `main`. If branch protection
  with required reviews is ever added, the bot push needs an exemption. Main pushes are
  currently open.
- That release commit also triggers the existing docs `deploy` workflow — harmless redeploy,
  but expected.

## 5. Versioning scheme

Enter the **1.0.0 line via a prerelease**, not `0.1.0`.

- **Why not `0.1.0`:** git tags already run `0.0.0`–`0.9.0`. release-it derives the next
  version from the latest tag; `0.1.0 < 0.9.0` would make the tooling and changelog range
  nonsensical. Existing tags carry no `v` prefix, which matches release-it's default tag
  format — keep that.
- **Path:** `1.0.0-beta.0` (npm `beta` dist-tag) → iterate betas → graduate to `1.0.0` once
  (a) chicio-blog validates it and (b) the device-loss fix lands. `1.0.0 > 0.9.0` keeps the
  tooling happy, and the beta lets chicio-blog consume a real published version immediately,
  exercising the true install path.
- The first `CHANGELOG.md` covers commits since `0.9.0` → `1.0.0-beta.0` (correct: everything
  since the last milestone).

## 6. `RELEASING.md`

A short maintainer doc at the **repo root** — NOT a section on the public Starlight site
(consumers don't release the package; it would be noise there). With release-it + the Action
doing the work, it stays brief: the one-time local bootstrap publish + trusted-publishing
setup, which `workflow_dispatch` increment to pick for beta vs graduate, how the changelog +
GH release + provenance are generated, and the dry-run-first tip.

## 7. Verification spikes (do first within SP-B)

1. **Shader pre-transform** — after the Vite lib build, inspect `dist/` for surviving
   `'use gpu'` directives; run a plugin-less throwaway consumer to confirm it executes. This
   also resolves `@typegpu/noise`'s dep classification.
2. **release-it explicit-increment + conventional-changelog interaction** — confirm
   `release-it major --preRelease=beta` actually produces `1.0.0-beta.0` (passing an explicit
   increment while the plugin also computes a bump is a known finicky corner). Validate with
   `--dry-run`.
3. **release-it + OIDC trusted publishing** — confirm release-it's pre-publish auth check
   doesn't trip without a token (it may need a config flag to skip the `npm whoami`-style
   check when relying on OIDC). Validate the CI workflow with `dry_run: true` first. Note
   provenance is automatic under trusted publishing (no `--provenance` needed), though a few
   reports mention having to set it explicitly — confirm during the spike.

## 8. Out of scope (this spec)

- **SP-A — chicio-blog validation harness.** Separate spec, later: extract `Matrix2DCanvas`
  (the current 2D impl as the fallback), add a WebGPU-detect → mount `<MatrixRainWebGPU>` →
  fallback orchestrator (on no-support or `onError`), verify paused parity, kept as a draft
  PR consuming `matrix-rain-webgpu@beta`, repointed to `1.0.0` after graduation.
- **Device-loss recovery** — separate work (probe committed `b58ab1f`; fix after overnight
  confirmation of `reason: "unknown"`).
- The optional `matrix-rain` → `matrix-rain-webgpu` directory rename.
