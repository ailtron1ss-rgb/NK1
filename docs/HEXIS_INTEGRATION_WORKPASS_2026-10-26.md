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

- The UI now stages external HMX JSON with an 8 MiB file precheck and a conservative 240,000-byte serialized request cap to remain below the server's default 256,000-byte request-body limit. Accept, canonical apply, goal materialization and goal activation each retain separate confirmation gates.
- API ingress now also rejects coercible malformed sync limits, belief confidence/trust/protection fields, outbox identifiers/ack flags and connector policy evaluation fields before those reach the core.
- The canonical HMX workflow now runs the app dependency install and TypeScript check, plus the existing UI-action-wiring and UI/API/runtime linkage audits.
- The server, not merely the UI, requires `confirmed: true` for both HMX acceptance and canonical apply. Smoke now verifies unconfirmed acceptance/application is rejected without preventing the later confirmed transition.
- A mistyped confirmation such as `confirmed: "true"` is rejected with HTTP 400; local checkout/test execution is blocked because this container cannot resolve `github.com`, and Actions job logs currently return `BlobNotFound`.
- GET memory/goal lists now enforce bounded integer limits and allowlisted goal status filters; temporal GET routes require real, safe-integer timestamp arguments instead of treating missing query values as zero.
- The operator console now shows the sealed apply receipt (status, imported/deduplicated counts, projected/deferred relationships, completeness and warnings) and per-section stage counts.
- After a console reload, manually re-entering a stage ID enables server-validated accept/reject/apply actions; local cached stage status is not trusted, and apply still requires the explicit confirmation checkbox.
