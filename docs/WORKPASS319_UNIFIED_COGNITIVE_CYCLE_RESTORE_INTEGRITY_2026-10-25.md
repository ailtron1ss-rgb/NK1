# WorkPass319 — unified cognitive-cycle restore consistency

**Date:** 2026-10-25  
**Source base:** `workpass206-runtime-evaluator-wiring` at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`  
**Work branch:** `nk1-ready-unified-cycle-restore-integrity-20261025`  
**Scope:** the restored `lastComplete` claim in `UnifiedCognitiveCycle`.

## Failure mode

The restore path recomputed `incompleteCycles` from `cycles - completeCycles`, but did not require the persisted count fields to agree before trusting `lastComplete`. A snapshot such as `cycles=10, completeCycles=8, incompleteCycles=8` could therefore retain a positive last-cycle claim despite contradictory aggregate history. The existing contract test already exercises this contradiction.

## Change

- Restored `lastComplete` is retained only if all four persisted counters are non-negative safe integers, the cycle partition exactly matches the canonical normalized partition, and `brokenLineages` does not exceed the normalized incomplete count.
- Invalid, missing, over-counted, or contradictory persisted counters fail closed for the last-cycle completion claim. Normalized aggregate counters are still preserved conservatively.
- Extended `workpass287-unified-cycle-contract.mjs` with a coherent persisted partition that must preserve `lastComplete=true`, and a partial snapshot that must not authenticate that claim.
- No new dependency; the existing WorkPass287-288 workflow runs the cycle contract, motivation contract, and B272 motivation-to-goal integration test on source/test changes.

## Verification status

The focused GitHub Actions workflow was triggered by the implementation and regression commits. Its exact run result must be checked before treating this branch as validated. Runtime typecheck, full organism E2E, real sandbox/verifier deployment, learning uplift, and release readiness are outside this narrowly scoped pass and are not claimed here.

## Exit checklist

- [x] Concrete restore inconsistency identified from the live source and existing regression.
- [x] Canonical restore path hardened without adding a second state owner.
- [x] Regression added for coherent and partial restore states.
- [x] README, CHANGELOG, and session start page updated on this branch.
- [ ] Focused Actions run succeeds on the PR head.
- [ ] Review and merge into the source integration stack; do not target the unrelated release/metadata `main`.
