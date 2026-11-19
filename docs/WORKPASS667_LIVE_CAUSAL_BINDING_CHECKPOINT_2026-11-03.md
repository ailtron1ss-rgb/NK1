# WorkPass667 — live causal outcome binding checkpoint

**Date:** 2026-11-03
**Project:** NeuroCore / нейроядро
**Repository:** https://github.com/ailtron1ss-rgb/NK1
**Branch:** `fix/live-causal-outcome-binding-2026-11-03`
**PR:** https://github.com/ailtron1ss-rgb/NK1/pull/692 (base `workpass70-source`)
**Fix commit:** `ee27cfc6`
**Base revision:** `4d02be84bc8dc87cc16ca520fbdc1e87ebb9cbf2`

> Checkpoint, not a completion claim. Re-query the live HEAD, PR state and newest Actions run at the start of every session; the SHAs above are evidence anchors.

## 1. Defect (OBSERVED, reproduced)

The live cognitive cycle minted **zero causal learning outcomes**. `OrganismCore.observe()` increments the world tick before recording the decision trace:

```ts
state.tick += 1;            // world tick advanced first
const decision = { tick: state.tick, stateBefore: previous, ... };  // stateBefore.tick === state.tick - 1
```

`CausalExperienceStream.recordOutcome()` required the opposite binding, so the guard rejected every live outcome. Two further clauses compounded the rejection:

| Clause | Live value | Old guard | Result |
|---|---|---|---|
| tick binding | `trace.tick === stateAfter.tick` | required `=== stateBefore.tick` | reject |
| success attribution | state stores observed `lastActionSuccess` (e.g. `0.82`) | compared to learning-scaled `input.success01` (e.g. `0.564`) | reject (`0.256 > 0.15`) |
| postcondition join | same tick convention | required `trace.tick === trace.stateBefore.tick` | reject |

Instrumented probe, before the fix:

```
RECORD {"traceTick":1,"sbTick":0,"saTick":1,"sel":"respond",...,"accepted":false}
live outcomes: 0
```

After the fix:

```
RECORD {"traceTick":1,"sbTick":0,"saTick":1,"sel":"respond",...,"accepted":true}
live outcomes: 3
```

The failure was invisible to the prior test suite because the causal tests that were green feed synthetic fixtures stamped with the pre-action tick, not the runtime convention.

## 2. Change (IMPLEMENTED, TESTED)

- `CausalExperienceStream.recordOutcome()` accepts a trace whose tick is either the pre-action tick or the tick of the state it produced, and still rejects a tick outside the observed transition (preserving the WorkPass283 protection against pairing an unrelated/old trace with a newer transition).
- Compares the observed (unscaled) success the state stores against the learning-scaled label the stream receives, via an explicit optional `observedSuccess01` supplied by the caller.
- Aligns the decision-linked external-postcondition join in `OrganismCore` with the same convention.
- Adds `tests/workpass667-causal-live-binding.mjs` and wires it into `.github/workflows/workpass79-cognitive-regression.yml`.

## 3. Evidence (OBSERVED)

| Check | Result |
|---|---|
| `npm run typecheck` | `TYPECHECK=PASS mode=tsc compiler=app-lock` |
| `npm run test:workpass84:script-integrity` | PASS (1843 scripts, 1470 local test refs, 1291 mjs syntax checks, 0 failures) |
| `tests/workpass667-causal-live-binding.mjs` | exit 1 before the fix → exit 0 after (`liveOutcomes` 0 → 3, `restoredOutcomes` 3) |
| `tests/p30-integration.mjs` | exit 1 → exit 0 (`P30_INTEGRATION=PASS action=respond samples=1`) |
| `recordOutcome` sweep (34 tests) | 31 pass; 3 fail identically on the base revision (`big-pass-310`, `big-pass-312`, `big-pass-91`) |
| GitHub Actions on `ee27cfc6` | all 35 checks pass (`local-language-resilience`, `correlated-postcondition`, `unified-organism`, `verified-learning` included) |

## 4. Remaining issues (UNRESOLVED, pre-existing)

None touched by this change; all fail on the base revision:

- `big-pass-102` / `big-pass-103`: `ExperienceContinuumFabric` reports `version:7`, tests expect `6`. Decide whether the bump is intentional and update the fixture, or the code regressed. Restore correctness depends on this contract.
- `big-pass-91`, `p2699`, `big-pass-101/104/106/114`, `big-pass-310/312`, `action-gateway-idempotency-workpass37` (1 of 13 sub-tests): separate defects; none is CI-wired.
- 13 CI jobs on the canonical head ran with 0 steps / `runner_id 0` — workflow/infra, not a code failure.

## 5. Next step

One triage pass over the pre-existing failures, starting with the `ExperienceContinuumFabric` version contract, deciding per test whether the fixture is stale (update it) or the code regressed (fix it).
