# WorkPass319 — unified cognitive-cycle and motivation integration closure

**Date:** 2026-10-25  
**Source base:** `workpass206-runtime-evaluator-wiring` at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`  
**Work branch:** `nk1-ready-unified-cycle-restore-integrity-20261025`  
**Scope:** close the focused WorkPass287/288/B272 integration gate without changing the release/metadata `main`.

## Failures reproduced from live CI

1. `UnifiedCognitiveCycle.restore()` trusted `lastComplete=true` despite contradictory persisted counters, e.g. `cycles=10, completeCycles=8, incompleteCycles=8`.
2. A mixed `lastMissingStages` list containing a valid stage plus malformed values discarded the valid stage. The contract requires preserving recognized values; a list with no recognized stages must fail closed to all required stages.
3. B272 computed future goal value from an unnormalized raw `dot(v, base)`. This could saturate the score at 1.0 and hide an increase in the confidence-weighted intrinsic drive. The integration regression failed with `calibrated intrinsic drive did not influence endogenous goal value`.
4. The repository-wide TypeScript check also found a string-indexing type error in the B272 needs validator; that loop now uses literal field keys (`as const`).

## Implemented

- Restored `lastComplete` now requires all four counters to be non-negative safe integers, a coherent cycle partition, and a broken-lineage count no larger than the incomplete count. Invalid/missing/inconsistent counters do not authenticate the completion flag.
- Missing-stage restore now keeps recognized stage IDs when they coexist with malformed values; wholly unrecognized/malformed input fails closed to the full required-stage list.
- B272 now scores bounded normalized world alignment and bounded reward/evidence signals. The trusted intrinsic drive retains measurable influence without depending on an unbounded dot product; confidence-zero drive remains unable to affect the score.
- The B272 need-field validation loop is statically typed with a tuple of literal keys.
- Added explicit restore regressions for coherent counters and incomplete snapshots; the pre-existing test also covers contradictory counts and malformed mixed-stage input.
- The focused WorkPass287/288 workflow remains scoped to its three behavioral tests; no new runtime dependency was introduced.
- Updated `README.md`, `CHANGELOG.md`, and `NEUROCORE_START_HERE.md`.

## Verification evidence

- [Run 40189833009](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40189833009) passed all three behavior steps on code commit `be1725549a433da9172650e99d4f100603f71db3`: unified cycle, intrinsic motivation, and B272 motivation-to-goal integration.
- [Run 40189992050](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40189992050) passed the same three behavior tests on commit `eb029490462a09fc66866fbb1b40dae823863a6e`, after the B272 literal-key typing fix and restoration of the focused workflow.
- [Run 40189874617](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40189874617) attempted `npm run typecheck` and **failed** with 88 TypeScript diagnostic lines across the wider runtime. The output included incomplete Node.js ambient shims, type/contract mismatches in other learning modules, duplicate implementations in `CognitiveEventFabric.ts`, and a regex error in `OutcomeVerificationService.ts`. One B272 field-index error from that run was corrected afterward; the repository-wide typecheck has not yet been rerun to a clean result.
- The typecheck failure is a real unresolved baseline blocker, not a pass. The narrow behavioral workflow deliberately remains independent so the focused tests can run; this does not turn the full runtime typecheck green.

## Scope boundary

The focused behavior tests prove only the specified contracts. They do **not** establish a clean repository-wide TypeScript check, organism-wide E2E, deployed OS/container sandbox isolation, independent learning uplift, real-device voice/Live2D behavior, production readiness, or subjective consciousness. Keep the PR in draft until the broader typecheck debt is resolved or separately approved as an explicit baseline exception.

## Exit checklist

- [x] Reproduce and fix the cognitive-cycle restore inconsistency.
- [x] Preserve recognized missing stages while failing closed on wholly malformed input.
- [x] Restore confidence-weighted intrinsic-drive influence on B272 goal value.
- [x] Fix the B272 literal-key TypeScript indexing issue.
- [x] Add/retain regression coverage for each discovered behavioral defect.
- [x] Focused workflow passes on current implementation commit.
- [x] Synchronize README, CHANGELOG and session handover.
- [ ] Resolve or formally disposition the repository-wide runtime typecheck failures.
- [ ] Confirm final PR-head behavior checks and review the source-stack PR; do not target the unrelated release/metadata `main`.
