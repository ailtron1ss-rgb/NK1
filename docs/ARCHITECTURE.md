# Architecture and ownership

```text
                    ┌──────────────────────────────┐
                    │     Neuro-Kurisu 35.59.0       │
                    │ runtime/neuro-kurisu         │
                    │ canonical writable organism  │
                    └──────────────┬───────────────┘
                                   │ HTTP API
                         ┌─────────▼─────────┐
                         │ app / Grok shell  │
                         │ routing + UI + HUD│
                         └──────┬─────┬──────┘
                                │     │
                   postMessage │     │ research HTTP
                                │     │
            ┌───────────────────▼┐   ┌▼────────────────────┐
            │ Live2D / legacy    │   │ research bridge     │
            │ visual-only        │   │ read-only probes    │
            └────────────────────┘   └──────┬─────────────┘
                                             │
                           ┌─────────────────┼─────────────────┐
                           │                 │                 │
                    NeuroCore V143    NOMEGA Pass20     DeepCode v21
                    research-only     governed-research research-only

legacy/* and legacy/input-archives preserve source history/provenance only.
```

## Runtime data flow

`app/src/neuro-kurisu/api.ts` → `/api/organism/*` → `runtime/neuro-kurisu/src/server/server.mjs` → `OrganismRuntime` / `OrganismCore`.

`AvatarStage.tsx` receives canonical emotion/speaking state and sends only rendering commands to Live2D. On Live2D failure the UI explicitly offers the real legacy sprite path; no synthetic portrait is drawn.

`ResearchDock.tsx` → `/api/research/*` → `research/research_bridge.py` → isolated research candidates. No research endpoint mutates canonical runtime state.

`tools/super-gateway.mjs` provides one local entry surface and forwards `/api/organism/*` and `/api/research/*` to their owners.


## Shared runtime policies (WorkPass36)

- Numeric and cosine primitives are centralized in `runtime/neuro-kurisu/src/organism/core/NumericPrimitives.ts`; modules retain their distinct thresholds and metrics where those are semantically different.
- Common action costs live in `organism/core/ActionCostPolicy.ts`. Active inference, contextual world prediction, policy learning and the organism core consume the same policy.
- Adapter fingerprints use `organism/core/StableSerialization.ts`. JSON-mode and legacy fingerprint-mode are explicit; historical fingerprints are not silently rewritten.
- `developmental/MemoryOS2.ts` is the sole writable memory authority. Legacy memory relations are carried as migration provenance and projected for compatibility; unresolved old IDs are not inserted into canonical relationship indices.
- Archived source snapshots are SHA-256/content-addressed and immutable. Never point historical manifests at mutable active source files.

## Unified cognitive-cycle ownership (canonical)

The cognitive cycle has exactly one owner per capability. Do not introduce a second ledger, fabric, economy, or cycle verifier.

| Capability | Canonical owner | Notes |
| --- | --- | --- |
| Cycle stage event journal | `CognitiveRuntimeCluster.cognitiveEventFabric` (`CognitiveEventFabric`, capacity 512) | Stages `observation`→`self-update`. Runtime stages its own operational cycle into this same fabric via `recordOperationalCycle`. |
| Cycle completeness verification | `CognitiveRuntimeCluster.unifiedCognitiveCycle` (`UnifiedCognitiveCycle`) | Evaluated at most once per tick; duplicate same-tick feedback is a bounded, recorded no-op. |
| Attention/compute budget | `CognitiveRuntimeCluster.cognitiveResourceEconomy` | One allocation per tick. |
| Reality/simulation evidence | `OrganismSystemFabric.governance.realityEvidenceLedger` (`RealityEvidenceLedger`) | Single canonical ledger. All writers — internal `OrganismCore.feedback` and the outer `OrganismRuntime` embodied loop — write through `OrganismCore.recordRealityEvidence(...)` or `OrganismCore.setRealityEvidenceLedger(...)`, which unions by immutable record id (`mergeFrom`). `OrganismRuntime` must not construct its own ledger. |
| Substrate coupling / action readiness | `DevelopmentalNeuralRuntime.unifiedCognitiveSubstrate` | Contributes one bounded `actionBias(...)` term to governed candidate scoring; it is not a planner or memory store. |

Persistence contract:

- `OrganismCore` persists canonical slots under `persisted.system.*`. The runtime projection is mirrored under `persisted.system.runtimeCognitiveEventFabric`, `runtimeCognitiveResourceEconomy`, and `runtimeUnifiedCognitiveCycle`.
- `migratePersistedOrganism` rebuilds `system` from an explicit key whitelist. Any new persisted cognitive slot must be added to that whitelist and its interface, or it is silently dropped on restart.
- On load, runtime restores runtime-namespaced slots first and falls back to the non-runtime slots for older snapshots.

Invariants enforced by regression tests:

- `tests/nk1-cognitive-unified-ownership-regression.mjs` — ledger merge/dedup, migration preservation, same-tick duplicate feedback, restart round-trip, architecture-map path resolution.
- `tests/workpass319-cycle-order.mjs` — causal ordering of the runtime cognitive-cycle close and canonical evidence write.
- `tests/workpass287-cognitive-architecture-contract.mjs` — architecture map integrity and repository-root-relative component resolution.
- `tests/big-pass-162-runtime-integration.mjs` — cycle/economy/ledger equality across restart.

