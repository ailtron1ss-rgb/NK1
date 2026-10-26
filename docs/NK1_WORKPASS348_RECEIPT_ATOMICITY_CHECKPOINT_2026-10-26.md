# NK1 checkpoint — WorkPass348 receipt transaction integrity

- Date: 2026-10-26
- Branch: `work/nk1-receipt-trace-atomic-2026-10-26-r1`
- Base SHA: `6a6a0d3b55675b439281c6dfc7a4c4839e1a1f3e` (includes WorkPass345/346/347 code fixes).
- Status: implementation and regression test committed; exact-head CI required.

## Defect and fix

`appendToolReceiptTrace()` writes three causally-linked events. Previously it could leave a partial trace if a later append threw. It also normalized tick and coerced identity fields before replay matching, so malformed inputs could be accepted on an exact-replay path.

1. Added `withAtomicLedgerMutation()` to roll back the event buffer, total and receipt projection index on failure.
2. Reused the transaction boundary for operational-cycle recording and three-event receipt projection.
3. Validate tick/timestamp/boolean/confidence/string types before fingerprint calculation or replay matching.
4. Reject oversized execution/tool/decision/observation IDs and text fields instead of silently truncating them into collisions.
5. Added tests for invalid replay input, side-effect-free type rejection, third-append failure and successful retry.
6. Added `test:workpass348:receipt-atomicity` to the required cognitive integration suite.
7. Updated CHANGELOG.

## Changed files

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- `runtime/neuro-kurisu/tests/workpass348-tool-receipt-atomicity.mjs`
- `runtime/neuro-kurisu/package.json`
- `CHANGELOG.md`

## Validation required

- `npm --prefix runtime/neuro-kurisu run typecheck`
- `npm --prefix runtime/neuro-kurisu run test:workpass348:receipt-atomicity`
- `npm --prefix runtime/neuro-kurisu run test:big-pass-379` when available
- `npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite`
- exact-head integration, P26, WorkPass110 and release-gate checks.

## Not claimed

- Exact-head CI is not yet green.
- No new ZIP has been built or published.
