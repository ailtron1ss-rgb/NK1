# NK1 checkpoint — WorkPass347 operational-cycle atomicity

- Date: 2026-10-26
- Branch: `work/nk1-operational-cycle-atomicity-2026-10-26-r1`
- Base SHA: `2d45e4f5766416fea8b3bcf7f71bb5792a5964b5` (includes merged WorkPass345/346 event-fabric hardening).
- Status: implementation and regression test committed; exact-head CI remains required.

## Defect

`recordOperationalCycle()` previously appended observation/prediction/appraisal and subsequent stages sequentially while validating each phase only inside `append()`. An invalid later phase could leave partial cycle evidence.

## Changes

1. Validate tick and timestamp before writes.
2. Preflight every provided phase's source, confidence, forwarded external flag and sanitized payload.
3. Resolve the stage order and causal parent links from a single phase specification.
4. Save an event-buffer/total/receipt-index rollback point before appends and restore it on any unexpected append exception.
5. Add regression tests for normal causal lineage, malformed late payload, invalid late source and injected mid-cycle append failure.
6. Add `test:workpass347:operational-cycle-atomicity` to `test:cognitive-integration-suite`.
7. Update CHANGELOG.

## Changed files

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- `runtime/neuro-kurisu/tests/workpass347-operational-cycle-atomicity.mjs`
- `runtime/neuro-kurisu/package.json`
- `CHANGELOG.md`

## Required validation

- `npm --prefix runtime/neuro-kurisu run typecheck`
- `npm --prefix runtime/neuro-kurisu run test:workpass347:operational-cycle-atomicity`
- `npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite`
- `npm run release:verify`
- Exact-head required Actions checks.

## Not claimed

- No exact-head CI result is claimed before completion.
- No new release ZIP was built or published.
- No claim is made that other WorkPass350/351/352 branches are wholly integrated beyond their fixes already represented in the active event-fabric PR.
