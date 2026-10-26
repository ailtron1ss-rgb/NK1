# NK1 checkpoint — WorkPass345 release-date contract

- Date: 2026-10-26
- Working branch: `work/nk1-release-date-contract-2026-10-26-r1`
- Base commit: `d795bd5513f0a99176c79f10d18c8cb4e69ced23`
- Base status: integration suite, P26 Learning Validation, WorkPass110 continual-learning metrics and progress-ledger integrity had passed on that base SHA. Those results do not validate this patch.
- Current patch status: code + regression tests committed on this branch; exact-head CI must be checked before calling this change verified.

## Problem fixed

`tools/verify-release-metadata.mjs` used a fixed fallback date (`2026-10-10`) when `SUPER_VERSION.date` was missing or malformed. That allowed a broken manifest to derive status-report and scorecard paths from an unrelated historical date.

## Changes in this pass

1. Added ISO calendar-date validation, including rejection of impossible dates.
2. Added the explicit `release-date-is-valid-iso-calendar-date` check.
3. Removed the historical fallback from status-report filename selection; invalid dates resolve to an invalid marker and the verifier fails closed.
4. Added consistency checks: `releaseRoot` date must match `SUPER_VERSION.date`, and the source baseline must not be dated after the release.
5. Updated the test fixture to declare its intended date.
6. Added regressions for missing date, impossible date `2026-02-30`, release-root date drift and a future-dated source baseline.
7. Updated `CHANGELOG.md`.

## Changed files

- `tools/verify-release-metadata.mjs`
- `tools/verify-release-metadata.test.mjs`
- `CHANGELOG.md`

## Required validation

- `node --test tools/verify-release-metadata.test.mjs`
- `node --test tools/verify-final-release.test.mjs`
- `npm run audit:release-metadata`
- `npm run release:verify`
- exact-head CI for the PR integrating this branch into `work/nk1-final-release-gate-2026-10-26-r3`

## Not claimed

- Full project integration is not proven by this focused change.
- The stale WorkPass70 release metadata and old published ZIP are not updated by this pass.
- No source branch merge or release publication was performed.
