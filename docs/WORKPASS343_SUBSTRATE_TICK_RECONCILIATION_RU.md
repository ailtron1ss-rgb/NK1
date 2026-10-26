# WorkPass343 — reconciliation of derived cognitive-substrate time

Дата: 26 октября 2026 г.  
Область: `UnifiedCognitiveSubstrate` restore / `OrganismRuntime.init()`

## Дефект

The substrate's persisted `lastTick` was validated only as a non-negative safe integer. On boot, the runtime then generated a new substrate tick as `max(cycle.state.tick, previousSubstrateState.lastTick + 1)`. If a sidecar had been saved ahead of the canonical Core snapshot—for example, due to an interrupted pair of durable writes—or contained `Number.MAX_SAFE_INTEGER`, each subsequent tick was forced further into the future. At the numeric limit, the next tick ceased to be a safe integer, and `integrate()` would reject it on every cycle.

The substrate is derived state, so it must not override the canonical organism clock.

## Fix

- Added `UnifiedCognitiveSubstrate.reconcileLastTick(canonicalTick)`.
- It validates the canonical Core tick as a non-negative safe integer.
- If the sidecar is ahead, it resets only `lastTick` to the canonical Core tick and preserves the derived cognitive metrics and cycle count.
- `OrganismRuntime.init()` invokes reconciliation immediately after restoring the sidecar, logs a bounded warning when alignment was needed, and falls back to the existing derived-state reset path if reconciliation itself is invalid.
- Sidecar ticks that are already aligned or behind the canonical tick are not changed; normal live cycles remain responsible for advancing the projection.

## Regression

The unified-substrate wiring test restores a sidecar at `Number.MAX_SAFE_INTEGER`, reconciles it to Core tick 7, checks that the other saved fields survive, verifies invalid canonical tick input is non-mutating, then integrates tick 8 successfully. The runtime contract also checks that the startup path calls reconciliation and emits the warning event.

Regression coverage now has two layers: (1) `tests/unified-substrate-runtime-wiring.mjs` checks `Number.MAX_SAFE_INTEGER` → canonical tick 7 → successful tick 8; (2) `tests/organism-smoke.mjs` corrupts the durable substrate sidecar's `lastTick` to `Number.MAX_SAFE_INTEGER`, restarts a real `OrganismRuntime`, verifies reconciliation, and runs another autonomous step to prove integration resumes. Both tests are in `npm run test:cognitive-integration-suite` via `test:unified-substrate-runtime-wiring`. The workflow's pull-request and branch-push path filters now explicitly include the wiring test. The current code/test head is `8b38a354e7a32ea8822e4cd44866c73f00ce0d1c`; a fresh exact-head CI result is still required.
