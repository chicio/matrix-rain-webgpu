# Releasing matrix-rain-webgpu

Maintainer runbook. Releases run from **GitHub Actions** via **OIDC trusted
publishing** — no npm token is stored anywhere. Versions and `CHANGELOG.md` are
derived automatically from [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major), so the
quality of a release depends on the quality of your commit messages.

> Tooling: [release-it](https://github.com/release-it/release-it) +
> `@release-it/conventional-changelog`, configured in `.release-it.json`. The
> workflow is `.github/workflows/release.yml`.

---

## One-time setup (do this once, ever)

npm's OIDC trusted publishing **cannot create a package that doesn't exist yet**
— the package must exist before you can configure a trusted publisher for it. So
the very first version is published from your machine, once:

1. **Bootstrap the first publish locally** (from a clean `main`):
   ```bash
   npm login                                   # your account, completes 2FA
   npx release-it major --preRelease=beta --dry-run   # verify first — see below
   npx release-it major --preRelease=beta             # publishes 1.0.0-beta.0
   ```
   This publishes `1.0.0-beta.0` under the npm `beta` tag, writes `CHANGELOG.md`,
   tags `1.0.0-beta.0`, and creates the GitHub release. Verify:
   ```bash
   npm view matrix-rain-webgpu@beta version    # → 1.0.0-beta.0
   ```

2. **Enable trusted publishing** so every future release is tokenless from CI:
   - npmjs.com → the `matrix-rain-webgpu` package → **Settings → Trusted
     Publishing**.
   - Add a **GitHub Actions** publisher: repo `chicio/matrix-rain-webgpu`,
     workflow file `release.yml`.
   - Select the **"publish"** allowed action (required for configs created after
     2026-05-20).

After this, never publish from your laptop again — use the workflow below.

---

## Cutting a release (every time)

### 1. Always dry-run first

GitHub → **Actions → Release → Run workflow**:
- Branch: `main`
- `increment`: pick per the table below
- `dry_run`: **true**

Read the run log and confirm: the **computed version** is what you expect, the
**`CHANGELOG.md` diff** looks right, and the **publish plan** targets the correct
npm tag. Nothing is published, tagged, or pushed on a dry run.

> The first dry-run after merging this PR doubles as the final validation that
> the CI environment works end-to-end (npm ≥ 11.5.1 upgrade + OIDC token).

### 2. Run it for real

Same dialog, same `increment`, `dry_run`: **false**.

| Goal | `increment` | Result | npm tag |
|------|-------------|--------|---------|
| First beta on the 1.0.0 line | `major-beta` | `1.0.0-beta.0` | `beta` |
| Next beta | `beta` | `1.0.0-beta.1`, `.2`, … | `beta` |
| Graduate beta → stable | `minor` (or `major`/`patch`) | `1.0.0` | `latest` |
| Routine release after 1.0.0 | `patch` / `minor` / `major` | bumped | `latest` |

Consumers get betas only if they opt in (`npm i matrix-rain-webgpu@beta`);
`@latest` is untouched until you graduate.

---

## What happens automatically

You do **none** of this by hand — the workflow + release-it do it all:

- Compute the next version and update `package.json`.
- Generate / update `CHANGELOG.md` from the conventional commits.
- Commit the bump + changelog, create the git tag, and push to `main`.
- Create the GitHub release with the changelog as its body.
- `npm publish` under the right tag, with a **signed provenance attestation**
  (npm shows a "Built and signed on GitHub Actions" badge — automatic under
  trusted publishing, no flag needed).

---

## Gotchas

- **The bump commit redeploys the docs site.** Pushing the release commit to
  `main` triggers `deploy.yml` — expected and harmless.
- **npm ≥ 11.5.1 is required** for trusted publishing; the workflow upgrades npm
  itself (`npm install -g npm@latest`), so you don't manage this.
- **`npm.skipChecks: true`** is set in `.release-it.json` on purpose: release-it's
  pre-flight `npm whoami` check has no credentials under OIDC (auth happens at
  publish time), so it must be skipped. The publish itself still authenticates.
- **Branch protection:** if `main` ever gets required-review protection, the
  `github-actions[bot]` push from release-it needs an exemption, or the release
  commit will be rejected.
- **Commit hygiene is the release.** Only `feat`/`fix`/`feat!` commits drive the
  version and appear in the changelog; `docs`/`chore`/`build`/`refactor` are
  filtered out of the changelog (but still shipped).
