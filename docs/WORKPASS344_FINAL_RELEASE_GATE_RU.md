# WorkPass344 — final release gate and CI workspace hygiene

**Date:** 26 October 2026  
**Branch:** `work/nk1-final-release-gate-2026-10-26-r3`  
**Code/test checkpoint:** `71176fa2275149a726a3aadeec827866d88a0cc0`  
**Status:** implementation committed; exact-head CI pending.

## Defects found by the new final gate

1. Root `npm run release:verify` did not invoke `tools/verify-release-metadata.mjs`. A green final-tree result could therefore coexist with inconsistent root/SUPER_VERSION, app/runtime package versions, lockfiles, status inventory or weighted score metadata.
2. Once metadata validation was added, the first full integration run exposed a false positive in the architecture scanner: the substrate regression contained a string literal that was parsed as an import edge. The assertion is now assembled from tokens and still checks the exact runtime import.
3. The next full integration run completed runtime/research smoke, then correctly rejected the Python `__pycache__/*.pyc` files created by that smoke. Those are transient workspace products, not tracked release-source members. We need the clean-release gate to stay strict while permitting the test runner to report its transient caches explicitly.

## Implementation

- `verify-final-release.mjs` accepts `--root`, rejects unknown arguments, runs UI wiring/architecture/release-metadata gates and fails closed if any gate is missing or non-zero.
- It reports `directCheckFailures` and `treeFailures` separately; overall `summary.failed` can no longer show zero when `ok=false` because tree hygiene failed.
- Default `npm run release:verify` remains **strict**: generated Python bytecode causes a failure.
- New `npm run release:verify:ci` enables only `--allow-generated-python-cache`. Each ignored transient cache is surfaced in `warnings`. Metadata integrity, architecture and UI wiring remain mandatory.
- The post-smoke step in the Unified project integration workflow uses `release:verify:ci`; the root `audit:workpass70` and operator launch guide continue to use strict `release:verify`.
- Six regression cases cover metadata success/failure/missing verifier, unknown CLI flag, strict pycache rejection, and explicit cache-tolerant CI mode.

## Operator launch path

```bash
npm run install:all
npm run install:research:cpu
npm run doctor
npm run test:final-release-verifier
npm run release:verify
npm run start
```

The strict verification should run on the clean candidate source tree before launch/package. The CI-only cache-tolerant variant is intended for a runner after Python research probes have executed.

## Previous and pending validation

WorkPass340–342 passed the combined runtime/cognitive/approval/research suite on exact code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f`. The source branch then added WorkPass343 substrate-tick reconciliation, which is preserved here.

The first WorkPass344 full run passed the four initial tests and metadata validator but failed on the architecture false positive. The second run passed app/runtime typechecks, cognitive tests, approval E2E and supervisor startup, then failed strict release verification on generated Python cache. The false-positive and cache-handling fixes in this checkpoint are authored but must pass a new exact-head CI before WorkPass344 can be merged.

## Remaining release gates

This does not rebuild or replace the large GitHub Release ZIP. Physical Android/Termux audio/sensor E2E, browser/Live2D hardware tests, long soak, and license/provenance review remain open.
