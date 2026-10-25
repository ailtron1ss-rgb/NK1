# WorkPass320 — reproducible runtime typecheck and dependency contract

**Date:** 2026-10-25  
**Branch:** `fix/runtime-typecheck-dependency-contracts-2026-10-25`  
**Base:** `nk1-ready-unified-cycle-restore-integrity-20261025`  
**Scope:** repair the runtime typecheck toolchain contract and add an exact-branch CI lane for cognitive integration. This pass does not modify `main` or publish a release.

## Evidence and root cause

The WorkPass319 checkpoint records a repository-wide TypeScript check that failed with 88 diagnostic lines. The downloaded job log confirms the runner did execute `npm run typecheck`, but the workflow did not install the app's locked dependencies first. In this repository, `runtime/neuro-kurisu/tsconfig.clean.json` explicitly resolves Node type definitions from both runtime-local and `app/node_modules/@types`, while `app/package-lock.json` is the canonical toolchain lock.

The diagnostics therefore mixed missing/incomplete Node ambient declarations and overloads with real source errors. It would be incorrect to call all 88 errors false positives: actual implementation defects can remain after restoring the proper type environment.

## Changes committed in this pass

- The runtime typecheck script now prefers the TypeScript compiler installed from the canonical app lockfile.
- If neither pinned compiler exists, the script exits with `TYPECHECK=BLOCKED` and tells the operator to install the locked toolchain; it no longer silently falls back to a machine-global compiler or reports syntax-only parsing as a semantic TypeScript pass.
- The compiler-selection regression now verifies that an available global `tsc` is never executed when the pinned compiler is absent.
- Added `.github/workflows/nk1-runtime-typecheck-dependencies.yml`: install the app toolchain with `npm ci --prefix app`, run the runtime semantic typecheck, and exercise cognitive-cycle, motivation, replay, causal-wiring, gateway and action-lifecycle regressions on the same branch head.

## Verification state

- Implementation commits: saved to this feature branch.
- Focused legacy WorkPass319 behavior checks: previously passed on their recorded commit; that historical run is not proof for this branch.
- Exact-head validation for WorkPass320: **pending** until the new workflow finishes on the feature branch.
- If typecheck still fails after the lockfile install, treat the remaining diagnostics as actionable source/type-contract failures and fix them rather than weakening compiler strictness or masking errors.

## Explicit non-goals and remaining release gates

This pass does not claim that all dependencies for every optional provider, avatar, voice or database deployment are configured; it does not prove production build/migration, browser/Live2D/audio E2E, host-isolated evaluator deployment, independently measured learning/retrieval gains, target-device soak, or license completeness. Keep release readiness separate from a passing typecheck and unit contract suite.
