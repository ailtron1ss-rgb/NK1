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

## Cognitive cycle ownership and recovery invariants

The runtime and internal decision loop share one canonical reality-evidence owner. Its write API validates tick, timestamp, class, claim, source identity and confidence before accepting provenance:
`OrganismCore` → `OrganismSystemFabric.governance.realityEvidenceLedger`.
The outer embodied loop records through `core.recordRealityEvidence(...)`; it must
not construct a second ledger or overwrite the Core projection. Persisted projections
are merged by immutable evidence ID, then snapshotted for durable storage.

The internal and outer cognitive loops have separate, namespaced cycle/fabric/economy
snapshots. Any new persisted slot must be represented in both
`PersistedShapeCurrent` and the explicit `migratePersistedOrganism` whitelist.
Add a migration regression whenever a slot is introduced.

A cognitive cycle is evaluated at most once per tick. Duplicate same-tick feedback
is recorded as a bounded diagnostic no-op so it cannot abort the remaining
learning/consolidation path. Evidence must preserve source and confidence: a simulator
transition, a user report and a fresh device observation are not interchangeable
proof of a real-world outcome.

Focused regressions:
- `npm run test:nk1:cognitive-unified-ownership`
- `node tests/workpass319-cycle-order.mjs`
- `node --experimental-strip-types tests/workpass287-cognitive-architecture-contract.mjs`

These contracts establish ownership, persistence and call-order invariants; they do
not by themselves prove real-device inference, memory uplift, autonomous behavior or
consciousness.
