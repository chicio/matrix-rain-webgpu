# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The full guidance lives in **[AGENTS.md](./AGENTS.md)** (shared across AI tools, per
[agents.md](https://agents.md)). It is imported below — read and follow it, especially the
**Working contract** (Mode A pair-programming for core CG/library code; Mode B
architect/developer for everything else) and the rules marked **(HARD)**.

**Skills:** this project keeps skills in **`.agents/skills/`** (the agents.md format) — *not*
Claude Code's default `.claude/skills/`. Look there: `typegpu` (TypeGPU/WebGPU references) and
`vercel-react-best-practices`. They're managed via `npx skills` and pinned in `skills-lock.json`.

@AGENTS.md
