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
- Added .github/workflows/nk1-runtime-typecheck-dependencies.yml: install both locked toolchains, typecheck both TS projects, production-build the app, run cognitive-cycle/motivation/learning/replay/causal/gateway contracts, server/security/restart smoke, and build+boot the Compose runtime.
- Added non-root Node 24 runtime container, loopback-only Compose port binding, persistent state volume and healthcheck; added .env.example, .dockerignore, secret ignores, a Russian quickstart and README entry point.
- Hardened P26 input validation and restore sanitization; added context-gated features and bounded interleaved replay, and stopped treating raw online updates/aggregate holdout inputs as independent generalization evidence.
- Unified project and compound-skill action execution through Core wrappers; validate restored ActionGateway completion receipts before replay; verify signed Hermes shadow evidence before parsing convenience fields.
- Fixed two B272 attribution paths so outcome learning is recorded only when the generated goal action was actually executed. Fixed P23 restore dedupe ordering and several stale/mis-specified regression contracts.

## Verification state

- **Verified code head:** 974a8cf5dea2093cad936f76a3fc43c86783ae3e.
- **Exact-head CI:** [run 40229027931](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40229027931) completed **success** with every configured job step successful.
- Both app and runtime typechecks passed; app production build passed; pinned compiler selection passed; cognitive-cycle, motivation, P26 schema/input integrity, recovery/continual matrix, causal replay, gateway/finalizer, planner route, server/security, restart and Docker Compose build/boot checks passed.
- Runtime smoke and HTTP server/security smoke passed, as did clean restart persistence. Compose health reported ready=true; built-in UI returned HTTP 200.
- P26 deterministic synthetic benchmark: context-separated tasks retained 0.9375 and 0.93125 accuracy after mixed training, with prior task baseline 0.99375. This is a synthetic algorithm regression test only, not an external/production learning score.
- Changes were committed on the feature branch; PR #129 remains draft and main remains untouched.

## Explicit non-goals and remaining release gates

The current GitHub Releases ZIP was not downloaded/rebuilt/replaced and still points to the Oct 19 WorkPass70 package; the current branch changes are not in that asset. Optional Gemini/local LLM/voice/Live2D/camera resources and keys are not configured by default. The checks do not prove production external-provider integration, browser/Live2D/audio E2E, host-isolated evaluator deployment, independently measured learning/retrieval gains, target-device soak, or license completeness. Keep release readiness separate from a green CI/runtime container smoke.

## Explicit non-goals and remaining release gates

This pass does not claim that all dependencies for every optional provider, avatar, voice or database deployment are configured; it does not prove production build/migration, browser/Live2D/audio E2E, host-isolated evaluator deployment, independently measured learning/retrieval gains, target-device soak, or license completeness. Keep release readiness separate from a passing typecheck and unit contract suite.
