# NK1 Hexis Integration Workpass — 2026-10-26

## Changes in this pass

- Hexis connector-policy restoration rejects malformed counters, non-finite values, malformed matching constraints and ambiguous duplicate policy IDs.
- HTTP grant validation no longer coerces permission strings to booleans; `"false"` cannot become autonomous permission.
- All 20 Hexis POST routes reject a non-record JSON body before accessing request fields or mutating state.
- Retention proposal ingress rejects unknown actions instead of silently substituting `compress`.
- Execution-plan ingress validates risk, placement, approval type and rationale. Risk at or above 0.6 always requires approval even when a caller passes `requiresApproval: false`.
- Outbox reclaim validates the age parameter before queue recovery.
- Goal materialization and activation require independent explicit confirmations. The lifecycle stays staged/applied HMX → reviewed proposal → approved → materialized paused project → activated project with relationship receipt.
- The Hexis console now has separate accept/apply confirmation, goal review/materialization/activation controls, typed API contracts, stage conflict/status display, a fix for `document` shadowing during HMX export, and refresh-error handling that preserves a committed operation result.
- Regression coverage was added to `tests/integration/hexis-adaptation.mjs` and `tests/integration/hexis-server-smoke.mjs`.

## Validation

The changes are committed on `fix/outcome-projection-index-restore-2026-10-26` and included in draft PR #236 against `workpass70-source`.

The GitHub Actions wrappers report failed runs but expose no job steps and return `BlobNotFound` when logs are requested. This is not sufficient evidence of test failure in code, nor a passing test result. Unit/runtime tests, frontend typecheck/build and clean-machine operation remain unverified. Do not treat the branch or the Release ZIP as production-ready until those checks can run to completion.
