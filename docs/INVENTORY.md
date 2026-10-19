# Structural inventory — 2026-10-06

## Top-level responsibilities

| Path | Role | Writable runtime state |
|---|---|---|
| `app/` | Delivery/UI shell | No |
| `runtime/neuro-kurisu/` | Canonical organism runtime | **Yes — single owner** |
| `research/neurocore-v143/` | Research candidate | No |
| `research/nomega-pass20/` | Governed research | No |
| `research/deepcode/` | Research candidate | No |
| `legacy/` | Historical/source provenance | No |
| `contracts/` | Machine-readable ownership/evidence | No |
| `tools/` | Project orchestration/audit | No |
| `docs/` | Navigation/architecture/runbook | No |

The machine-generated counts and provenance hashes are in `contracts/inventory/source-inventory-2026-10-06.json` and `contracts/inventory/provenance-2026-10-06.json`.

## Canonical connection points

- UI API adapter: `app/src/neuro-kurisu/api.ts`
- UI normalization: `app/src/neuro-kurisu/normalize.ts`
- UI state bridge: `app/src/organism/store.ts`
- Runtime HTTP owner: `runtime/neuro-kurisu/src/server/server.mjs`
- Runtime core: `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts`
- Live2D viewer: `app/public/live2d/viewer.html`
- Legacy renderer: `app/src/legacy/avatar/LegacySpriteDeck.tsx`
- Research bridge: `research/research_bridge.py`
- Gateway: `tools/super-gateway.mjs`

## Asset integrity

The current sprite manifest is validated against `app/public/sprites`. Legacy visual profiles now select only real sprite ids; there is no procedural avatar substitute.
