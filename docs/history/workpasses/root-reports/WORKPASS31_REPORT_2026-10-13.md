# WorkPass31 — unified canonical memory lifecycle gateway

Date: 2026-10-13  
Base: `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS30_2026-10-13.zip`  
Root version: `31.0.0-super-final17`  
Canonical runtime: `35.54.0` / schema 224

## What changed in the product code

WorkPass31 consolidates canonical MemoryOS2 mutation entry points behind the existing `MemoryFabric` owner. The gateway covers encode, epistemic status revision, content correction, signal updates, context patches and forgetting. It is not a new memory store; MemoryOS2 stays the only writable canonical substrate.

A receipt journal capped at 512 entries binds command IDs to stable SHA-256 fingerprints. Exact retries after restore return the original command outcome without repeating mutations, incrementing counters or emitting another event. Changed-payload reuse of a command ID fails with `MemoryLifecycleCommandConflictError`.

Compatibility imports have deterministic command IDs and use the gateway. Production Hexis review and external research ingestion now call through `MemoryFabric`, as does `MemorySubsystemRuntime` restore consolidation. `StateMigrations` now preserves and validates the receipt journal; this closed the actual normal-restore gap missed by direct object restore tests. Old coordinator write helpers are explicitly legacy adapters retained for historical callers, not used by production restore.

## Code paths touched

- `runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts`
- `runtime/neuro-kurisu/src/organism/developmental/MemorySubstrateCoordinator.ts`
- `runtime/neuro-kurisu/src/organism/core/MemorySubsystemRuntime.ts`
- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`
- `runtime/neuro-kurisu/src/organism/persistence/StateMigrations.ts`
- `runtime/neuro-kurisu/tests/memory-lifecycle-command-workpass31.mjs`

## Acceptance relevant to this change

- Runtime TypeScript typecheck: PASS.
- New lifecycle regression: PASS (normal migration, retry after restore, collision detection, legacy import dedupe, no-op update, forgetting, receipt cap).
- Existing source provenance lineage regression: PASS.
- Existing Memo/MemoryOS2/Hexis canonical temporal regression: PASS.
- Existing standalone HTTP server smoke: PASS. Root release metadata, source imports, UI/API route linkage and asset audits: PASS; release readiness is not claimed.

## Explicit limitations

The receipt journal is deliberately bounded at 512 commands; a command evicted from that window can be applied again if a remote caller illegally replays an old ID. All retry-sensitive callers should provide stable IDs. Legacy coordinator write helpers still exist for historical test/migration callers and should be removed only after their consumers are migrated. Independent temporal holdout, retrieval superiority over BM25, real NLI inference/provider runs, app production build/browser Live2D E2E, clean-room recovery/rollback, soak and final sign-off remain open.
