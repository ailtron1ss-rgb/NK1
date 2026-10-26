# WorkPass344 — fail-closed final release verification

**Date:** 26 October 2026  
**Branch:** `work/nk1-final-release-gate-2026-10-26-r3`  
**Code/test checkpoint:** `6cf87a07f28b208b809506925f4cbd6fb163636c`  
**Status:** implementation committed; exact-head CI pending.

## Defect

The root `npm run release:verify` command previously checked filesystem hygiene, generated Python artifacts, known secret paths, UI/API wiring and runtime architecture, but did not execute `tools/verify-release-metadata.mjs`. A final-tree run could therefore report green while root/SUPER_VERSION data, app/runtime manifests and lockfiles, current-status documents or weighted score arithmetic were inconsistent.

## Code and tests

- `tools/verify-final-release.mjs` accepts `--root`, rejects unknown CLI arguments, emits structured per-check results, and runs UI wiring, architecture and release metadata as mandatory fail-closed gates.
- The metadata validator receives the selected root via `--root <root>`; a missing validator or non-zero exit fails the final gate.
- `tools/verify-final-release.test.mjs` exercises four cases: valid metadata, invalid metadata, missing validator and unknown CLI argument.
- Root `test:final-release-verifier` is wired into `audit:workpass70`.
- The unified project integration workflow runs the new regression and `npm run release:verify` after the full runtime/research smoke. Path filters include release verifier and metadata inputs.

## CI finding and correction

The first WorkPass344 run passed the four new regression cases but failed the final architecture check. The architecture audit's lightweight import scanner had mistaken a string literal in `unified-substrate-runtime-wiring.mjs` for a second relative import. The test now constructs its expected import string from separate tokens, so it still verifies the runtime wiring without exposing a fake import edge to the source scanner.

The current candidate includes the source base's WorkPass343 substrate-tick reconciliation improvement as well as WorkPass344. The earlier WorkPass340–342 tests are still valid evidence for their original exact head `621864d0d7f2676245383adab86f1dcc6d0f741f`, but do not replace a new combined-head run.

## Operator launch path

```bash
npm run install:all
npm run install:research:cpu
npm run doctor
npm run test:final-release-verifier
npm run release:verify
npm run start
```

Gateway/UI listens on `127.0.0.1:8080`, runtime on `127.0.0.1:3310`, and Research Bridge on `127.0.0.1:8765`. Research network operations remain under explicit approval and allowlist.

## Remaining release gates

This change only closes a missing metadata check. It does not rebuild/replace the large published GitHub Release ZIP. Physical Android/Termux sensor/audio E2E, browser/Live2D hardware tests, extended soak and license/provenance review remain open.
