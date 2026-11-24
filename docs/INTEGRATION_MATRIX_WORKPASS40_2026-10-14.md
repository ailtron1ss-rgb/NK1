# WorkPass40 — integration matrix — 2026-10-14

| Area | Canonical owner | WorkPass40 integration | Boundary / unresolved evidence |
|---|---|---|---|
| Organism life/runtime | `OrganismCore` | remains the single writable life-state owner | full semantic coverage and soak remain open |
| Memory | MemoryOS2 through MemoryFabric | unchanged; remains sole writable canonical memory | real local model embeddings and independent temporal holdout remain open |
| Action execution | ActionGateway + durable receipt ledger | preserved from WorkPass37/38; restore now has lock and rollback hardening | provider/device authoritative receipt reconciliation and reconnect/replay remain open |
| State persistence | `FileStateStore` / `tools/lib/state-backup.mjs` | atomic restore lock, checksum-verified staging, exact set and rollback staging | full clean-room partial-commit fault test remains open |
| Language model routing | P40 Model Ecology | optional `llama.cpp` profile and loopback-only chat adapter; old snapshots merge defaults | mocked API tested; target inference not run |
| Affect/attention | existing affect/homeostasis and CognitiveNetworkBus | preserved; no duplicate emotional state owner added | calibration against human-labeled behavior remains research |
| UI and Live2D | `app` as delivery UI; runtime HTTP API as cognition boundary | kept intact; capability exposed through existing server/config surfaces | Vite build and real browser Live2D E2E remain open |
| Upstream provenance | `legacy/input-archives`, SBOM/provenance JSON | archive SHA-256, member counts, license-file evidence and npm lock inventory | archive contents still require nested-license/manual review; no external clone downloaded |
| Research branches | isolated `research/` and source archive snapshots | continue as read-only research/provenance | no automatic promotion and no second memory/runtime owner |

## Ownership decisions
- llama.cpp is used as an OpenAI-compatible local server boundary. The C/C++ engine and model weights are not vendored; this avoids a duplicate engine, large binary payload, and unreviewed platform-specific build.
- Graphiti-like temporal-graph infrastructure is not installed as a second writable memory owner: MemoryOS2 stays canonical. Useful temporal-indexing ideas can be transferred selectively after a separate code/behavior/license review.
- Letta/Hexis/Lumina/Conscio/WILL remain adapter/source-derived boundaries according to the existing integration contract, not independent organisms.
