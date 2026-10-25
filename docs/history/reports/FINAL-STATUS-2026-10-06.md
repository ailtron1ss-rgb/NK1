# Neuro-Kurisu SUPER — Final internal status

## Current role
This is an integrated engineering project with one canonical writable cognitive runtime: `runtime/neuro-kurisu` (Neuro-Kurisu 35.40.0, schema 223).

## Integrated surfaces
- `app/`: Grok Workspace delivery/UI shell, connected to the canonical runtime via HTTP.
- `app/public/live2d/`: supplied Live2D desktop/mobile assets and motion/expression dependency graph.
- `app/src/legacy/avatar/`: real sprite compatibility renderer using the supplied 32-frame manifest; no procedural portrait fallback.
- `research/`: NeuroCore V143, NOMEGA Pass20 and DeepCode v21 exposed only through a read-only research bridge.
- `legacy/`: historical branches, snapshots and exact original input archives kept for provenance and comparison.
- `contracts/`, `docs/`, `tools/`: ownership, inventory, conflict classification and repeatable audit tooling.

## Important internal changes in this release
- Removed zero-filled canonical UI `inner` and empty `embedding` projections that had no real backend source.
- Wired identity trait values to canonical B270 runtime state.
- Made Live2D failure explicit instead of silently rendering a synthetic portrait.
- Restricted legacy visual profiles to actual sprite-manifest assets.
- Removed an unreachable duplicate symbolic `sum3` implementation.
- Restored the original Grok `.grok` reference/skills tree.
- Preserved exact input archives and provenance hashes.
- Excluded runtime state, caches, bytecode and dependency directories from the release artifact.

## Compatibility model
There is no dual writable organism. Legacy and research implementations are isolated and cannot silently replace the canonical runtime. External hardware/provider absence is reported as unavailable/degraded rather than simulated as success.

## Build constraint
The source artifact intentionally does not ship `node_modules`. The full Vite/TypeScript UI build must be performed with dependencies installed from `app/package-lock.json` in a normal build environment.
