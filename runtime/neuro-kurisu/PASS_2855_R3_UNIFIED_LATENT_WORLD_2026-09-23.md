# Neuro-Kurisu 35.26.0 / P2855 — R3 Unified Latent World State

## Purpose

R3 converts the world-model layer from a set of cooperating predictors into one explicit production causal contract:

`observation(t) -> latent(t) -> prediction ticket -> action -> outcome -> latent(t+1)`

Specialized predictors remain contributors. They no longer own the cross-model latent-state/prediction ticket authority.

## Implemented

1. Added `src/organism/world/UnifiedLatentWorldState.ts`.
   - canonical observation record;
   - canonical 32D latent state frame;
   - bounded prediction ticket ledger;
   - bounded counterfactual ticket ledger;
   - prediction resolution/error tracking;
   - explicit provenance and source-latent vector for each prediction;
   - snapshot/restore support.
2. Integrated the authority into `WorldSubsystemRuntime`.
   - grounded observations enter the canonical latent state;
   - `predictForDecision()` creates the single pre-action production ticket;
   - preview/model calls do not create hidden canonical tickets;
   - outcome resolution closes the exact pre-action ticket;
   - the post-action observation advances canonical latent state immediately.
3. Routed P2524/P2525/P2522/P2523 through the canonical latent state.
   - P2524 receives the canonical latent vector as world experience context;
   - P2525 receives the same pre-action latent vector as transition context;
   - P2522 and P2523 receive canonical uncertainty/coherence and latent anchors;
   - P2523 counterfactual branches are registered as canonical tickets.
4. Fixed a real integration gap in `IntentCandidate.worldPredictionId`.
   - candidates now carry the exact canonical prediction ticket used before execution;
   - outcome calibration can resolve that ticket instead of manufacturing fresh evidence.
5. Added R3 tests:
   - `tests/r3-unified-latent-world-state.mjs`
   - `tests/r3-unified-latent-world-ablation.mjs`
   - `tests/r3-unified-latent-world-restart.mjs`
6. Added npm scripts `test:r3:unified-latent-world`, `test:r3:ablation`, `test:r3:restart`, and `test:r3`.

## Verification

### Canonical causal routing

`R3_UNIFIED_LATENT_WORLD_PASS`

- observations: 2 in the one-step causal cycle (pre-action + outcome observation)
- canonical prediction tickets: 7
- canonical counterfactual tickets: 7
- P2524 queries: 1
- P2525 queries: 1
- P2522 cycles: 1
- P2523 cycles: 1
- canonical prediction resolves successfully on outcome

### Causal ablation

`R3_UNIFIED_LATENT_ABLATION_PASS`

A matched canonical-latent vs lesion-latent route produced measurable downstream changes:

- P2524 effect: 0.00000 in this seed
- P2525 effect: 0.01134
- P2522 effect: 0.04843
- P2523 effect: 0.01116

This is evidence of route dependence for several downstream components, not an intelligence or consciousness score.

### Persistence

`R3_UNIFIED_LATENT_RESTART_PASS`

- canonical latent id survives snapshot/restore;
- latent vector survives snapshot/restore;
- prediction ticket survives snapshot/restore;
- restored ticket can be resolved by the subsequent outcome;
- post-outcome canonical latent advances to the new tick.

### Regression

- `TYPECHECK=PASS mode=tsc`
- `CANONICAL_POLICY_LIVE_PASS`: 7/7 action candidates receive P2855 contribution.
- P2855 ablation: policy ON accuracy 0.2667 vs OFF 0.1667 in the existing controlled benchmark.
- `B2521_RUNTIME_PASS`: 10 cycles, 280 rollouts, 10 learning updates, 9 transitions; accuracy 0.5753; coverage 0.4133; counterfactual use 0.1912.
- `CLEAN_ORGANISM_SMOKE=PASS`
- `CLEAN_RESTART_PERSISTENCE=PASS`
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1658 canonicalFiles=530 missing=0 cycles=0 legacyLeakage=0`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_HYGIENE files=3667 errors=0 warnings=0`

## Important remaining limitation

The 80-cycle autonomy run is still not treated as passed. Long-run latency/heap growth remains a separate R7 engineering problem. R3 does not hide or reinterpret that limitation.

## Architecture result

The production world path now has one explicit causal state authority while specialized world models remain replaceable contributors. Observation, latent state, prediction and counterfactual state are separate typed concepts, and the selected action carries the exact prediction ticket back into outcome learning.

## Next implementation target

R4: temporal credit consolidation — delayed outcome attribution, n-step return/eligibility mechanisms, action-to-transition-to-outcome credit, and independent delayed-credit holdouts/lesions.
