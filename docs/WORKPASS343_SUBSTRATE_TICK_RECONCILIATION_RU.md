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

Target command: `node --experimental-strip-types tests/unified-substrate-runtime-wiring.mjs` inside `runtime/neuro-kurisu`. The WorkPass340 exact-head smoke remains useful; new WorkPass343 code/test changes still require a fresh combined-head CI run.
