# Lumina → Neuro-Kurisu SUPER integration report — 2026-10-08

## Canonical ownership

Lumina is adapted as a product/tooling surface. Neuro-Kurisu remains the only canonical writable organism, memory, identity, learning and persistence owner. WILL remains an adapter-only contract layer.

## Implemented

- capability risk profiles and channel policy
- exact lexical search projection over canonical memory/goals/skills/events
- application idempotency ledger with result hashes
- channel-aware request telemetry
- browser policy/session seam without a second browser owner
- voice operation telemetry tied to the existing VoiceEmbodiment/runtime endpoints
- operator UI exposing previously backend-only WILL and voice operations
- integration overview, capability, search, PMA, idempotency, transport, replay and integrity HTTP surfaces
- provenance archive of the supplied lumina-main.zip

## Deliberately not copied

The Lumina agent loop, SQLite memory authority, PySide UI, flat project/skill authority and unreviewed self-modifying executor were not copied because equivalent canonical Neuro-Kurisu owners already exist.

## Validation

- runtime TypeScript compiler check: PASS
- Lumina adapter tests: 2/2 PASS
- WILL integration + surfaces: 12/12 PASS
- server smoke including new integration and voice endpoints: PASS
- UI/function route wiring audit: PASS, 17/17 API methods wired to the active Operator Console
- app full TypeScript/Vite build remains blocked by the supplied environment lacking app/node_modules
