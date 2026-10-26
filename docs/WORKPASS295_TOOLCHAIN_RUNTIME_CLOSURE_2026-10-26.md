# WorkPass295 — toolchain, supervisor and P23 persistence closure

**Date:** 2026-10-26  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active branch:** `work/nk1-toolchain-cognitive-closure-20261025-r2`  
**Code head validated by the last completed cross-cutting run:** `3f1c38d67e9adccbae1bf20ef4aea61e244a603b`  
**Draft PR:** [#141](https://github.com/ailtron1ss-rgb/NK1/pull/141), based on `audit/repository-wiring-contracts-2026-10-25`; not merged.

> This checkpoint records the code changes and observed CI status, not whole-product completion. Always re-read the live PR head/checks before promoting any result to PASS.

## Changes implemented

### Node 24 contract
- Root, app and runtime package engines aligned with `.nvmrc` Node 24; the two existing package-lock files were synchronized.
- Added reusable `tools/toolchain-contract.mjs` and regression tests.
- `super-doctor`, `super-install`, and `super-start` use the same Node/npm contract. Install rejects package/lock metadata disagreement before dependency installation.
- The P26 learning-validation workflow uses Node 24. A dedicated toolchain workflow runs contract tests, supervisor tests and the environment doctor.

### Supervised runtime startup and failure signals
- Extracted pure child exit/spawn-error decisions and covered planned shutdown, unexpected exit code 0, nonzero exit, signals, missing status, spawn error and message sanitization.
- Unexpected child failure now shuts down the required-service group and propagates supervisor exit code 1. Host SIGINT/SIGTERM preserve conventional status 130/143.
- Fixed the startup working-directory defect: the runtime process uses `runtime/neuro-kurisu` as its cwd, so relative `src/server/server.mjs` resolves. Research bridge, UI preview and gateway remain rooted at the repository.
- Added `tools/supervised-service-specs.mjs` plus tests that validate the configured working directories and verify every configured entrypoint exists from its declared cwd. This check is part of `audit:quick` and the Node 24 CI workflow.

### P23 durable candidate store
- Corrected a production mismatch between candidate ID generation in `VersionedSkillCandidateStore` and persisted-candidate validation in `AtomicFileSkillStorePersistence`. New identity uses the provenance fingerprint slot (or explicit `null`); malformed provenance is rejected; legacy four-field identities are allowed only without provenance.
- Added disk persistence/restart regression coverage for normal candidates and provenance-bearing candidates.
- Updated rollback and signed-shadow end-to-end fixtures to match the current approval and candidate identity contracts. Production approval/rollback verifiers remain default-deny; signed evidence verification was not weakened.

## CI evidence and exact-head status

Completed successes on code head `3f1c38d67e9adccbae1bf20ef4aea61e244a603b`:
- [Repository wiring contract audit](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090535) — PASS.
- [WorkPass291 reflective payload budget](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090616) — PASS.
- [WorkPass292 verified experience lanes](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090688) — PASS.

At last observation, these exact-head runs were not yet complete:
- [WorkPass110 continual learning metrics](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090556) — queued. Earlier attempts exposed and helped fix the candidate-store identity mismatch and then a stale signed-shadow fixture; neither earlier failure is a current-head pass.
- [NK1 toolchain contract](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090559) — queued.
- [P26 Learning Validation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090577) — in progress.
- [WorkPass102 reservoir replay baseline](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090523) and [WorkPass294 correlated external postconditions](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252090539) — queued.

Additional successes on preceding head `3a53e7f` include toolchain contract, repository wiring audit, WorkPass105 verified outcome ledger, WorkPass99 replay strategy benchmark, WorkPass102 reservoir replay baseline, WorkPass291 and WorkPass292. These are useful baseline evidence but do not replace exact-head validation after the later entrypoint/candidate-fixture changes.

## Unverified / blocked

- Current head's WorkPass110, toolchain and P26 runs must complete; if canceled by a newer commit, require a run against the new head.
- A clean-room full install + app production build + both typechecks + real multi-service startup/restore smoke has not been completed in this pass.
- The latest 135 MB GitHub Release ZIP could not be downloaded through the available environment. No release asset was replaced, re-uploaded or verified. This PR is source-stack work only.
- No upstream architecture was vendored and no dependency was added in this pass. No independent learning/recall uplift is claimed; subjective consciousness is outside the evidence.

## Next queue

1. Refresh the live branch head and check WorkPass110/toolchain/P26 exact-head results; fix failures without reducing security assertions.
2. Run runtime and app typechecks, production app build, runtime smoke and a clean multi-service launch/restore with explicit readiness checks.
3. Verify install/build instructions and the supervisor's behavior if preview assets or Python runtime dependencies are absent; failures must be actionable and nonzero.
4. When release binary access is available, rebuild the canonical release artifact from the validated source and compare its integrity; never describe the existing ZIP as updated beforehand.
5. Keep PR #141 draft and do not merge to `main` from this source/audit branch.
