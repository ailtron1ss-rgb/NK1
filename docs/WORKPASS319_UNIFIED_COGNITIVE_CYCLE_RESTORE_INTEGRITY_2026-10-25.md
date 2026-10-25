# WorkPass319 — unified cognitive-cycle and motivation integration closure

**Date:** 2026-10-25  
**Source base:** `workpass206-runtime-evaluator-wiring` at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`  
**Work branch:** `nk1-ready-unified-cycle-restore-integrity-20261025`  
**Scope:** close the focused WorkPass287/288/B272 integration gate without changing the release/metadata `main`.

## Failures reproduced from live CI

1. `UnifiedCognitiveCycle.restore()` trusted `lastComplete=true` despite contradictory persisted counters, e.g. `cycles=10, completeCycles=8, incompleteCycles=8`.
2. A mixed `lastMissingStages` list containing a valid stage plus malformed values discarded the valid stage. The contract requires preserving recognized values; a list with no recognized stages must fail closed to all required stages.
3. B272 computed future goal value from an unnormalized raw `dot(v, base)`. This could saturate the score at 1.0 and hide an increase in the confidence-weighted intrinsic drive. The integration regression failed with `calibrated intrinsic drive did not influence endogenous goal value`.

## Implemented

- Restored `lastComplete` now requires all four counters to be non-negative safe integers, a coherent cycle partition, and a broken-lineage count no larger than the incomplete count. Invalid/missing/inconsistent counters do not authenticate the completion flag.
- Missing-stage restore now keeps recognized stage IDs when they coexist with malformed values; wholly unrecognized/malformed input fails closed to the full required-stage list.
- B272 now scores bounded normalized world alignment and bounded reward/evidence signals. The trusted intrinsic drive retains measurable influence without depending on an unbounded dot product; confidence-zero drive remains unable to affect the score.
- Added explicit restore regressions for coherent counters and incomplete snapshots; the pre-existing test also covers contradictory counts and malformed mixed-stage input.
- Extended `.github/workflows/workpass287-288-cognitive-contracts.yml` to run `npm run typecheck` before the three behavior tests.
- Updated `README.md`, `CHANGELOG.md`, and `NEUROCORE_START_HERE.md`. No new runtime dependency was introduced.

## Verification evidence

- [Run 40189833009](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40189833009) passed all three behavior steps on code commit `be1725549a433da9172650e99d4f100603f71db3`: unified cycle, intrinsic motivation, and B272 motivation-to-goal integration.
- [Run 40189874617](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40189874617) was triggered after adding the runtime typecheck step; its final result must be confirmed before this branch is treated as review-ready.
- The earlier failed runs are retained as diagnostic history, not hidden: they exposed the malformed-stage normalization and saturated goal-value defects that are now fixed.

## Scope boundary

Passing these focused checks demonstrates the targeted contracts only. It does **not** establish organism-wide E2E, deployed OS/container sandbox isolation, independent learning uplift, real-device voice/Live2D behavior, production readiness, or subjective consciousness.

## Exit checklist

- [x] Reproduce and fix the cognitive-cycle restore inconsistency.
- [x] Preserve recognized missing stages while failing closed on wholly malformed input.
- [x] Restore confidence-weighted intrinsic-drive influence on B272 goal value.
- [x] Add/retain regression coverage for each discovered defect.
- [x] Add runtime typecheck to the focused CI gate.
- [x] Synchronize README, CHANGELOG and session handover.
- [ ] Confirm final workflow run and PR-head CI.
- [ ] Request review/merge into the source integration stack; do not target the unrelated release/metadata `main`.
