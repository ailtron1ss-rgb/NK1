# P0 RuntimeCheckpointEnvelope — selective rebase
Date: 2026-11-28
Status: RED test stage; no production implementation added yet.

## Canonical base
- Repository: `ailtron1ss-rgb/NK1`
- Branch: `workpass70-source`
- Parent SHA: `7f9f1bcdb68f3ddc95a07fe0e0be9952d8a80872`
- Parent tree: `bf76560f1e5b918e663b89395d452666adcf0651`

## Donor
- PR #1198, `aspect/p0-persistence-integration-20261126`
- Donor HEAD: `54cbd67bd4df8cd134cb260991f6f1c14e2cf218`
- Historical exact-head Actions: 79/79 succeeded on 2026-11-26.
- Donor PR is not being merged wholesale: 11/29 paths overlap 106 newer canonical commits.

## First acceptance contract
A forced `OrganismRuntime.flush()` must place a schema-v2, manifest-bound envelope inside the canonical Core JSON. The envelope must:
- have the same `coreTick` as the saved Core state;
- bind a world tick and all five owners (world, openLoop, cognitiveSpine, riskAwareRecovery, cognitiveHealth);
- include the durable OperationalJournal cursor;
- expose the same committed generation through runtime diagnostics.

## Test-first record
- Added `tests/runtime-checkpoint-envelope-revival.mjs` before production edits.
- Expected RED: `runtimeCheckpointEnvelope` is absent from the canonical state after the current forced flush.
- Focused GitHub Actions workflow: `nk1-runtime-checkpoint-envelope-regression.yml`.
- The test has not yet been observed running; its exact-head result will be recorded below.

## Preservation rules
- Keep canonical `OperationalJournal.ts` cursor implementation (post-PR #1237); do not copy donor journal code.
- Keep canonical RecoveryWatchdog two-phase `checkpointCandidate/commitCheckpoint`; do not transplant donor callback checkpoint.
- Keep current OrganismCore full integrity/recovery/continuity transaction and insert envelope creation directly around its existing `store.save`.
- Do not wholesale copy any of the 11 overlapping PR #1198 paths.
