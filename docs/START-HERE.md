# Neuro-Kurisu SUPER — Start Here

## What this project is

A single integrated engineering project with one executable cognitive owner:

- `runtime/neuro-kurisu` — canonical Neuro-Kurisu 35.41.0 runtime, writable state owner.
- `app` — Grok Workspace delivery shell and UI; it consumes the canonical runtime through HTTP.
- `app/public/live2d` — real Live2D model/runtime assets.
- `app/src/legacy/avatar` — real legacy sprite compatibility path (visual-only).
- `research/*` — isolated research candidates and qualification bridge.
- `legacy/*` — immutable historical branches/provenance, not a second live brain.

## First files to read

1. `README.md`
2. `contracts/OWNERSHIP.md`
3. `docs/ARCHITECTURE.md`
4. `docs/INVENTORY.md`
5. `docs/CONFLICTS-AND-GAPS.md`
6. `docs/RUNBOOK.md`

## Runtime ownership rule

There is exactly one writable organism runtime. UI, visual layers and research candidates must not create a second mutable organism state.
