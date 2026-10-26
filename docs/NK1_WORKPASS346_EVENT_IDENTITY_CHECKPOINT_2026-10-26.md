# NK1 checkpoint — WorkPass346 cognitive-event identity

- Date: 2026-10-26
- Branch: `work/nk1-cef-event-identity-2026-10-26-r1`
- Base: `489fe7d735c5bb00af484f40415f1769b313c479` (includes merged WorkPass345 release-date contract)
- Status: implementation and regression test are committed; the branch is being rebased onto the release candidate after WorkPass345 merged; exact-head CI remains pending.

## Defect

`CognitiveEventFabric.append()` treated an existing ID as a replay if tick, stage and source matched, even when payload, timestamp, parent IDs, external status or confidence differed. Shallow payload copies also allowed nested caller mutation to change in-memory event evidence.

## Changes

1. Validate the complete normalized event envelope before mutating the ledger.
2. Reject changed evidence under a reused event ID with `cognitive-event-id-conflict`.
3. Reuse the saved timestamp when replay omits `at`; explicit timestamp changes are conflicts.
4. Deep-clone stored and returned payloads.
5. Avoid executing top-level getters when projecting payload records.
6. Add regression coverage for envelope conflicts, key-order-equivalent JSON, nested mutation, getter behavior and cyclic payloads.
7. Wire the regression into the runtime cognitive integration suite.
8. Update `CHANGELOG.md`.

## Changed files

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- `runtime/neuro-kurisu/tests/workpass345-cognitive-event-fabric-identity.mjs`
- `runtime/neuro-kurisu/package.json`
- `CHANGELOG.md` (WorkPass346 entry is placed ahead of the already integrated WorkPass345 release-date contract)

## Required validation

- `npm --prefix runtime/neuro-kurisu run typecheck`
- `npm --prefix runtime/neuro-kurisu run test:workpass345:event-identity`
- `npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite`
- `npm run release:verify`
- All required exact-head CI checks on this branch and the eventual release-candidate SHA.

## Not claimed

- Exact-head CI has not yet been confirmed green.
- WorkPass350/351/352 kernel branches have not been integrated by this change.
- No release metadata update, ZIP build, or publication is claimed.
