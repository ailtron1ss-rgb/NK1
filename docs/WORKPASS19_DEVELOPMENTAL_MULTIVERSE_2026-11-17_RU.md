# WorkPass 19 — Developmental Multiverse (2026-11-17)

## Status

**IMPLEMENTED — bounded experiment coordinator, first integration slice.** This is not yet an autonomous subprocess farm and does not apply candidate policies to the live organism.

The implementation extends the existing P55 developmental-fork concept through `DevelopmentalMultiverse` and `variantsFromP55Forks()`. P55's active data-only forks can become experiment arms; rejected/replaced forks are excluded.

## Lifecycle

1. `createSession()` accepts one source revision, one environment fingerprint, a five-knob baseline policy profile, candidate deltas, matched validation scenario/seed pairs, and a disjoint holdout scenario set.
2. `validationWorkPlan()` emits the baseline control plus every candidate for every validation pair. The work items share the same initial-state fingerprint and pair fingerprint. The only mutable state exported is the explicit five-number policy profile; memory, conversations, identity records, credentials, and executable code are not copied.
3. The host evaluator records bounded metrics (`quality01`, `cost01`, `safety01`, `stability01`) against the exact work-item fingerprints. Duplicate measurements, unplanned scenarios, changed environments, altered policy profiles, and mismatched source/state bindings are rejected.
4. `selectValidationFinalist()` uses validation pairs only. It enforces non-regressing safety, zero candidate safety violations, bounded cost/stability regressions, and a minimum utility gain. At most one candidate is selected.
5. `holdoutWorkPlan()` then exposes the untouched holdout pairs to baseline + finalist only. Non-finalists never receive holdout items.
6. `finalize()` requires at least five paired holdout observations and a positive lower 95% paired confidence bound, while enforcing the safety/cost/stability gates again. The result is `eligible-for-independent-review` or `rejected`.

Utility is a transparent comparison aid: 0.45 × quality + 0.25 × safety + 0.20 × stability + 0.10 × (1 − normalized cost). Safety violations are a hard veto, not something that can be offset by quality.

## Safety and persistence

- The experiment coordinator is off-cycle. It does not run automatically on the hot cognitive tick.
- It creates data-only work plans; the host is responsible for executing each arm in a genuinely isolated process/runtime and collecting observations.
- A positive local holdout result is **not independent verification**. The decision explicitly requires independent verification and never promotes or writes a profile to live policy.
- Snapshot restore replays observations through the same binding checks and recomputes the selection/result; persisted decision fields are not trusted.
- Session inputs are normalized through a strict allowlist; additional caller fields are discarded.

## Verification

- `tests/developmental-multiverse.mjs`: matched arms, baseline identity, validation-only selection, finalist-only holdout, paired confidence bound, hard safety veto, tampered binding/snapshot rejection, restart replay, P55 adapter filtering, and no automatic promotion.
- The focused Node 22 test passes locally.
- Full runtime typecheck and repository Actions remain authoritative and must pass on the exact PR HEAD before merge.

## Remaining integration work

- Bind work items to the existing host-owned independent executor/verifier/safety-scanner services; this module currently exposes the contract and records observations but does not claim to spawn or isolate child processes itself.
- Run a clean synthetic benchmark suite with fixed artifacts and at least five independent holdout seeds per finalist.
- Only after the independent evaluator returns authenticated evidence should the existing governance/promotion pipeline be asked to consider a policy change. No direct P55 action-bias change is made here.
- No Release ZIP was rebuilt or published by this work pass.
