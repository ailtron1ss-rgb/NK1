# WorkPass344 — fail-closed final release verification

**Date:** 26 October 2026  
**Branch:** `work/nk1-final-release-gate-2026-10-26-r2`  
**Status:** implementation committed; exact-head CI pending.

## Defect

The root `npm run release:verify` command previously checked filesystem hygiene, generated Python artifacts, known secret paths, UI/API wiring and runtime architecture, but did not execute `tools/verify-release-metadata.mjs`. Operators could therefore receive a green final-tree result while root/SUPER_VERSION data, app/runtime package and lockfile versions, current-status documents or weighted score arithmetic were inconsistent.

## Code and tests

- `tools/verify-final-release.mjs` now accepts `--root`, rejects unknown CLI arguments, emits structured per-check results, and runs UI wiring, architecture and release metadata as mandatory fail-closed checks.
- The release metadata validator receives the selected root via `--root <root>`; a missing validator or a non-zero exit fails the final gate.
- `tools/verify-final-release.test.mjs` exercises four cases: valid metadata, invalid metadata, missing validator and unknown CLI argument.
- Root `test:final-release-verifier` is wired into `audit:workpass70`.
- The unified project integration workflow runs the new regression and `npm run release:verify` after the runtime/research smoke, and its path filters include release verifier/metadata inputs.

## CI finding and correction

The first WorkPass343 run passed the new four tests but `release:verify` failed the architecture audit. The audit's lightweight import scanner treated a string literal inside `unified-substrate-runtime-wiring.mjs` as an actual relative import. The source test now constructs the expected import assertion from separate tokens, preserving the runtime wiring assertion without presenting a fake import edge to the architecture scanner. The fixed test must be validated in the current combined head; the earlier failure is retained as a real finding, not reported as a pass.

## Launch path

```bash
npm run install:all
npm run install:research:cpu
npm run doctor
npm run test:final-release-verifier
npm run release:verify
npm run start
```

The root supervisor starts the gateway/UI on `127.0.0.1:8080`, the runtime on `127.0.0.1:3310`, and the research bridge on `127.0.0.1:8765`. Research network actions remain governed by explicit approval and allowlist settings.

## Validation and remaining release gates

The previous combined WorkPass340–342 code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f` passed runtime/app typecheck, cognitive substrate restore/wiring, 30-cycle restart smoke, supervised startup and Research Bridge approval E2E. The source base has since added a WorkPass343 substrate-tick reconciliation change; that newer work and WorkPass344 must receive current exact-head CI before promotion.

This gate only closes metadata omission. The large published release ZIP has not been rebuilt/replaced. Physical Android/Termux audio/sensor E2E, browser/Live2D hardware tests, extended soak, and license/provenance review remain open.
