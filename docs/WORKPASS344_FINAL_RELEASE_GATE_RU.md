# WorkPass344 — final release gate and CI workspace hygiene

**Date:** 26 October 2026  
**Branch:** `work/nk1-final-release-gate-2026-10-26-r3`  
**Code/test checkpoint:** `064a7ac8f2cd91e692d7e7d3905a8a608a6a92b6`  
**Status:** implementation committed; exact-head CI pending.

## Defects found

1. `npm run release:verify` omitted the canonical `verify-release-metadata.mjs` gate.
2. The architecture audit mistook a literal import assertion in the substrate wiring test for a real import edge.
3. Research smoke generates Python bytecode, which correctly fails a strict clean-tree check if the test is run before release packaging.
4. The JSON summary omitted tree failures from `summary.failed`, allowing `ok=false` and `failed=0` at the same time.
5. A cache-aware CI override must not hide tracked bytecode that is actually part of the release source.

## Implementation

- `verify-final-release.mjs` runs UI wiring, architecture and release metadata as mandatory gates; it accepts `--root`, rejects unknown args and counts direct-check and tree-hygiene failures separately.
- Default `npm run release:verify` remains strict.
- `npm run release:verify:ci` is only for use after research smoke. It allows only an untracked `.pyc` file inside an `__pycache__` directory and lists each ignored item as a warning. The verifier obtains tracked paths from `git ls-files -z`; a tracked bytecode member still fails. A stray `.pyc` elsewhere and non-bytecode files in cache directories also fail.
- Root `test:final-release-verifier` is wired into `audit:workpass70`; the Unified project integration workflow runs it and then `release:verify:ci`.
- Eight regression cases cover metadata pass/fail/missing validator, unknown CLI flag, strict pycache rejection, transient CI cache allowance, stray/non-bytecode rejection, and tracked-bytecode rejection.
- The substrate wiring test builds its expected import assertion from tokens to avoid the architecture scanner false positive.

## Operator launch path

```bash
npm run install:all
npm run install:research:cpu
npm run doctor
npm run test:final-release-verifier
npm run release:verify
npm run start
```

Run strict verification on a clean source/release candidate. The cache-aware variant belongs only in CI after Python research probes have run.

## Validation status and limitations

WorkPass340–342 passed on exact combined head `621864d0d7f2676245383adab86f1dcc6d0f741f`. WorkPass343 substrate-tick reconciliation is preserved on the current base. Previous WorkPass344 CI passed earlier implementation but not the latest tracked-bytecode guard and regression; the combined-head run must be repeated on `064a7ac8f2cd91e692d7e7d3905a8a608a6a92b6`.

This does not rebuild/replace the large GitHub Release ZIP. Physical Android/Termux sensor/audio E2E, browser/Live2D hardware testing, extended soak, and license/provenance review remain open.
