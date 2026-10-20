# WorkPass94 — verification evidence/input binding

**Date:** 2026-10-20  
**Branch:** `workpass79-cognitive-rebuild`  
**PR:** [#1 — draft, unmerged](https://github.com/ailtron1ss-rgb/NK1/pull/1)

## Defect addressed

`isTrustedExternalPostconditionVerification(value, expectedInput)` previously compared only the key/value pairs supplied by the caller. A partial expected input such as `{ resource: "relay-main" }` could therefore match a trusted verification generated for a larger action input that also included the desired state and execution options. That weakened the helper's stated contract that the evidence be bound to the same action input.

## Code changes

- `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts`
  - Expected input is now compared as a complete canonical structural JSON value using the shared `stableJson` serializer.
  - Partial inputs, changed nested parameters, changed postconditions and non-serializable values fail closed.
  - Structurally identical clones remain valid; the original WeakMap trust registration is still required, so copying the verification object does not copy trust.
- `runtime/neuro-kurisu/tests/workpass94-verification-input-binding.mjs`
  - Covers exact input, equivalent deep copies, partial input rejection, nested parameter mismatch, desired-state mismatch, copied result rejection and circular input rejection.
- `.github/workflows/workpass94-verification-input-binding.yml`
  - Adds a focused Node 22 CI job for the regression.

## Commits

- Runtime fix: [c4829d7629bb416f585cc6f5a36c80d7841c776a](https://github.com/ailtron1ss-rgb/NK1/commit/c4829d7629bb416f585cc6f5a36c80d7841c776a)
- Regression: [7428f4e667eeb0c9ff87e9b74c07e11ce596bdd5](https://github.com/ailtron1ss-rgb/NK1/commit/7428f4e667eeb0c9ff87e9b74c07e11ce596bdd5)
- CI workflow: [94e1aab67b972374dfa3d7ebd42ee0cb41ad1ef1](https://github.com/ailtron1ss-rgb/NK1/commit/94e1aab67b972374dfa3d7ebd42ee0cb41ad1ef1)

## Evidence status

- **IMPLEMENTED:** source binding is strict and canonical.
- **REGRESSION ADDED:** behavioral cases are present and wired to a dedicated workflow.
- **CI PENDING / NOT YET OBSERVED:** no workflow run was returned for the workflow commit at checkpoint time; do not claim the test passed until the exact-head Actions run is visible and green.
- **UNRESOLVED:** live provider/device action recovery, independent RU/EN retrieval uplift, learning transfer/retention, real browser/Live2D/TTS E2E, target-device performance and release readiness remain open.

## Next actions

1. Verify the new WorkPass94 workflow ran on the current branch head and inspect its job result.
2. Run the runtime typecheck and the existing WorkPass57/59/63 learning/evidence firewall regressions against the strict binding change; adapt only if a call site was intentionally passing a partial input, and keep that use fail-closed.
3. Extend the action proof matrix across absent, stale, spoofed, late, duplicate and contradictory postcondition evidence through restart/reconciliation.
4. Continue the highest-impact runtime fault-injection work; keep PR #1 draft and unmerged.
