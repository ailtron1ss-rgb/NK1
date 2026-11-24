# WorkPass 37 implementation report — 2026-10-13

## Goal
Join action execution, duplicate suppression, independently verified outcomes and targeted feedback into one canonical lifecycle while preserving the existing source line, Legacy history and UI.

## Implementation changes

1. `ActionGateway.ts`: persistent SHA-256-keyed idempotency receipts, per-key concurrent joining, payload conflict detection, pending-recovery fail-closed logic, expected-output validation, bounded replay data and failure-aware receipt checkpointing.
2. `OrganismCore.ts`: persist/restore the ledger; finalize outcome, observer projection and exact decision-linked temporal credit before the completed receipt commit; suppress duplicate learning/outcome on retries.
3. Reusable skills and API routes: deterministic per-step idempotency keys and `Idempotency-Key` support for project/tool/step and skill execution.
4. `StateMigrations.ts` + ReleaseContract: schema 225 carries a bounded action receipt ledger; the current package, lockfile, version contract and integration manifest align on 35.59.0/schema 225. New migration regression tests schema 223/224 input, default ledger, and record retention.
5. Retrieval benchmark: corrects the synthetic benchmark to use a shared explicit `asOfAt` with `temporalMode='at'`; no claim of quality uplift is made, and promotion remains disabled at recall delta 0.
6. Root/runtime audit definitions and release/task documentation updated for WorkPass37.

## Verification

- Focused action-gateway idempotency suite: 13/13.
- WILL pre-arbitration: 17/17.
- Runtime TypeScript typecheck: PASS.
- Schema 223/224 migration alignment: PASS.
- Memory retrieval benchmark: PASS as a correctly timed synthetic benchmark; measured uplift 0; not promoted.
- Root release metadata, app-script suite, browser smoke verdict/report and resource/linkage checks are included in `npm run audit:workpass37` and must pass in the final packaged tree.

## Limitations / honest status

A completed local checkpoint is not proof of exactly-once behavior from arbitrary remote providers: if external execution may have happened and a durable receipt is absent, the gateway fails closed and marks recovery required. Real remote receipt semantics are still open. The app's dependency-installed React/Vite production build, actual browser/Live2D E2E, real model/provider inference, independent labelled retrieval holdout, clean-room rollback and soak are not claimed complete. Overall weighted release readiness is **73.7%**; implementation workpass progress is **85/100**.
