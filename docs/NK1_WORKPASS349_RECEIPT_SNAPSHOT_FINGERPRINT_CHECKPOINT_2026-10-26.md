# NK1 checkpoint — WorkPass349 receipt snapshot fingerprint integrity

- Date: 2026-10-26
- Branch: `work/nk1-receipt-snapshot-fingerprint-2026-10-26-r1`
- Base SHA: `2ffc075da79b3c7f90809e676848535ddfd63900` (includes merged WorkPass345–348 event/receipt hardening).
- Status: code and regression test committed; exact-head CI required.

## Defect

`CognitiveEventFabric.restore()` restored replay-index rows after validating referenced event IDs and causal links, but did not recompute a modern `projectionHash` against the event envelope. Syntactically valid but inconsistent persisted hashes could survive restore and cause false idempotency decisions.

## Changes

1. Reconstruct modern receipt projection input from retained action/outcome/evidence events.
2. Validate both event-level postcondition hashes are present and well-formed together.
3. Restore the index only when the recomputed normalized fingerprint matches the saved projection hash.
4. Retain legacy compatibility only when both event-level hashes are absent and the old full-input hash is valid.
5. Add regressions for tampered projection index, tampered event hashes, partial hash pair and legitimate legacy receipt recovery.
6. Add `test:workpass349:snapshot-fingerprint` to the required cognitive integration suite.
7. Update CHANGELOG.

## Changed files

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- `runtime/neuro-kurisu/tests/workpass349-receipt-snapshot-fingerprint.mjs`
- `runtime/neuro-kurisu/package.json`
- `CHANGELOG.md`

## Required validation

- `npm --prefix runtime/neuro-kurisu run typecheck`
- `npm --prefix runtime/neuro-kurisu run test:workpass349:snapshot-fingerprint`
- `npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite`
- exact-head unified integration, P26, WorkPass110 and release-gate checks.

## Not claimed

- Exact-head CI is not yet green.
- No new release ZIP was built or published.
