<!-- Thanks for contributing! Keep the title in Conventional Commits form — it drives the changelog and the release version. -->

## What & why

<!-- What does this change, and why? Link any related issue (e.g. Closes #12). -->

## Type of change

<!-- Pick the one that matches your commit/PR title — it determines the release bump. -->

- [ ] `fix:` — bug fix (patch release)
- [ ] `feat:` — new feature (minor release)
- [ ] `feat!:` / `BREAKING CHANGE:` — breaking change (major release)
- [ ] `docs:` / `chore:` / `refactor:` / `build:` / `ci:` — no release

## Checklist

- [ ] `npm run check` passes (oxlint + oxfmt)
- [ ] `npm run types` passes (tsc)
- [ ] `npm run build` succeeds
- [ ] Docs updated if the public API or behaviour changed
- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/)
