# PASS 2855 — R7 Performance / Long-Horizon Stability — 2026-09-24

## Purpose
R7 targets the real runtime bottleneck exposed by the 80-cycle autonomy test: increasing latency and heap/GC pressure during long runs. This pass prioritizes real runtime cost reduction without removing the canonical cognitive, policy, memory, world-model, self/agency, or continuity paths.

## Implemented

### 1. B301 mobile state-economy fast path
`src/organism/system/B301MobileStateEconomy.ts`
- The normal checkpoint path no longer JSON-serializes the entire organism merely to discover that no bounded history needs compaction.
- The economy first checks configured bounded-history lengths.
- Full byte accounting occurs only when actual compaction is required.
- Existing compaction limits and protected canonical branches remain unchanged.

### 2. Checkpoint diagnostic de-duplication
`src/organism/core/OrganismCore.ts`
- Removed a second full `JSON.stringify(this.persisted)` pass at every checkpoint.
- Full durable saves reuse the persistence store's measured payload size.
- Partial checkpoints reuse the last known payload size.
- This preserves diagnostics while removing a redundant whole-organism serialization allocation.

### 3. World-model pending-ticket pruning
- `src/organism/developmental/WorldModel2.ts`
- `src/organism/system/WorldModelEnsembleController.ts`

Pruning is now cadence-gated (every 8 prune calls) and uses a no-sort fast path when the pending set is already within bounds and fresh. The 256-ticket bound and age bound remain enforced; this is a computational cadence change, not a removal of prediction evidence.

### 4. Regression guard
Added `tests/r7-performance-guards.mjs` and `test:r7:guards`.
It verifies:
- B301 no-compaction fast path;
- WorldModel pending predictions remain bounded;
- ensemble pending predictions remain bounded.

## Runtime evidence
A 20-cycle mobile-profile probe after R7 measured approximately:
- mean cycle latency: ~409 ms;
- cycle 20: ~432 ms;
- heap samples remained substantially below the earlier uncontrolled trajectory at equivalent short horizons.

A 40-cycle probe completed successfully in this environment:
- mean latency at cycle 40: ~508 ms;
- cycle 40: ~621 ms.

A 50-cycle probe completed successfully:
- mean latency at cycle 50: ~553 ms;
- cycle 50: ~695 ms;
- heap at sample point: ~374 MB before forced GC.

A forced-GC diagnostic at 50 cycles reduced heap to ~118 MB, showing that a large portion of the observed growth is allocation/GC pressure rather than proof of a retained-state leak. Long-horizon latency still rises and remains an active R7/R8 issue.

## CPU-profile findings
The profile identified `structuredClone`, checkpointing, B301 byte accounting, and repeated world-model pending-ticket pruning as material hot paths. R7 directly removed/reduced redundant work in those paths.

The largest persistent state surfaces observed at 50 cycles included:
- `system.neuralExperienceBranch` ~1.36 MB;
- `facets.advanced` ~1.71 MB;
- `facets.learning` ~0.72 MB;
- `system.cognitiveDomainClosure` ~0.82 MB.

Inside `neuralExperienceBranch`, the largest bounded surfaces were replayBuffer (~350 KB), embodiedBridge (~136 KB), inputEligibility (~131 KB), and inputProjection (~130 KB). These are bounded structures rather than unbounded arrays in this pass.

## Verification
- `TYPECHECK=PASS mode=tsc`
- `test:r7:guards` = PASS
- `test:canonical-policy` = PASS
- `test:self-agency` = PASS
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1671 canonicalFiles=533 missing=0 cycles=0 legacyLeakage=0`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_HYGIENE files=3686 errors=0 warnings=0`

## Important non-claims
R7 does **not** establish consciousness, human-level intelligence, or mobile readiness. The 80-cycle autonomy test remains a long-horizon stress target and was not marked PASS merely because shorter probes improved.

## Next R7/R8 targets
1. Reduce checkpoint clone amplification without weakening crash-recovery semantics.
2. Profile `NeuralExperienceBranch` substructures for repeated snapshot/clone churn.
3. Introduce explicit allocation budgets for replay/eligibility/causal evidence paths.
4. Add 80/120/240-cycle endurance tiers with independent holdout checks.
5. Separate durable-state snapshots from hot runtime projections more aggressively where causal persistence is unaffected.
6. Preserve R3-R6 ablations and restart evidence while measuring performance changes.
