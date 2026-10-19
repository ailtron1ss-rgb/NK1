# Super-project ownership contract

## Canonical
Neuro-Kurisu 35.54.0 is the only writable owner of the organism runtime. It owns decision-making, memory, goals, semantic world, embodiment state, persistence, learning and API truth.

## Delivery layer
The Grok Workspace code is retained as the application shell: routing, polished UI, auth/data scaffolding, chat surface, HUD and Labs layout. The former browser-organism implementation is archived under `app/src/legacy/browser-organism/` and is not an active brain.

## Visual layer
Live2D uses the canonical model assets already shared with the 35.47.0 build. The legacy sprite path imports the v9 sprite resolver/outfit catalog and follows the v56 crossfade presentation pattern. Neither visual path owns cognition or state.

## Research layer
NeuroCore V143, NOMEGA Pass20 and DeepCode v21 are research candidates. They are exposed through a read-only research bridge for qualification and smoke probes. No automatic promotion, mutation of the canonical runtime or dual-write state is permitted.

## Duplicate policy
When multiple branches implement the same conceptual capability, the newest validated Neuro-Kurisu implementation is canonical; alternatives are either visual compatibility, research candidates or historical snapshots. Adapters must cross an explicit boundary rather than copying state.

## Temporal memory integration (WorkPass29)

`MemoryOS2` owns validity windows and revision lineage. Hexis belief/audit records may retain bounded evidence receipts, but point-in-time memory lookup and temporal diffs delegate to canonical `MemoryOS2`; they must not become a competing timeline. Memo-derived content-addressed identity is a canonical reconciliation primitive; explicit corrections receive lineage-scoped revision IDs when wording is reused.


## WorkPass30 — provenance is integrated, not a second memory

`MemoryOS2` remains the single writable memory owner. Research/EvidenceFirewall lineage identifiers are carried into the bounded `evidenceSources` trail on canonical items; up to eight visible independent lineages are retained with a bounded 32-key replay guard. Repeated publisher mirrors using the same lineage do not count as independent corroboration. Hexis and Runtime Atlas inspect the canonical projection; they do not own a shadow evidence/memory timeline.


## WorkPass31 — canonical mutation lifecycle and replay-safe restore

`MemoryFabric` is the single application-level mutation gateway for canonical MemoryOS2 writes, revision/status changes, signals, context patches and forgetting. A bounded 512-receipt journal is persisted and normalized by `StateMigrations`; same-key payload collisions fail closed and exact retries after normal restore do not repeat mutations or lifecycle events. Compatibility, Hexis and external research paths use the gateway; compatibility projections remain read/adaptation layers.
