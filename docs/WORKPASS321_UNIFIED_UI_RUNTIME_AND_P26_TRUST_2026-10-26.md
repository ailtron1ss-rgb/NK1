# WorkPass321 — unified React UI, canonical runtime and trusted evidence boundary

**Date:** 2026-10-26  
**Branch:** `fix/runtime-typecheck-dependency-contracts-2026-10-25`  
**Verified code head:** `e5bdcaf2732bd38298c27160ff612b66f4d16253`  
**Validation:** [GitHub Actions run 40250314917](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40250314917) — success.

## Summary

This pass moved the clean-machine launch from “runtime with its bundled page” to the real React/TanStack app sharing one origin with the canonical cognitive runtime. The app is served by Nitro's standalone Node preset, the runtime stays private inside Compose, and Caddy is the only host-published service (loopback by default).

## Concrete changes

- Added a multi-stage Node.js 24 app image. Its build includes both `app/`, the canonical runtime public assets and the root hash-locked `contracts/inventory` manifest required by the app's Live2D asset hydrator.
- Made `app/vite.config.ts` use `NITRO_PRESET` for the deployment build and allow the dev API proxy target to be configured without changing the default Vercel build preset.
- Added same-origin routing in Caddy: React UI requests go to the app server; `/api/organism/*`, `/api/research/*`, and runtime health requests route to the canonical runtime.
- Kept the runtime on an internal-only Compose port, shared an internal `NEURO_API_TOKEN` between Caddy and runtime, and kept the host listener bound to `127.0.0.1` by default. The runtime returns a retryable 503 for protected API routes during initialization rather than exposing initialization exceptions as 500s.
- Configured persistent PGlite directory support via `PGLITE_DATA_DIR`; the app database and organism state use separate named volumes.
- Kept the Docker images non-root and added healthchecks for app, runtime and gateway. The Compose regression verifies the UI, `/api/health` and the canonical cognitive architecture validation through the same origin.
- Hardened P26 restore: metric counters are normalized, newest unique trace IDs survive restore, the feature schema migration remains semantic, and training batches reject malformed samples atomically.
- Added a fail-closed host-verifier boundary for independent holdout evidence. Caller-supplied `verified=true` and `independent=true` flags alone no longer promote generalization evidence; restored records are revalidated too.
- Earlier changes in this branch also validate persisted ActionGateway receipts, route project/compound-skill actions through the canonical Core wrapper, guard both B272 outcome-learning paths against action misattribution, verify Hermes signed evidence before trusting its metadata, and repair P23 replay-dedupe restoration.

## Exact-head verification

All steps in run 40250314917 passed on code head `e5bdcaf2732bd38298c27160ff612b66f4d16253`:

- App TypeScript and runtime semantic TypeScript checks; locked app/runtime dependency installs.
- Frontend production build and pinned-compiler selection contract.
- Unified cognitive-cycle, intrinsic motivation, motivation-to-goal and runtime wiring.
- Causal replay, P26 schema/input/holdout provenance/recovery/continual-learning regression suite.
- ActionGateway receipt integrity, finalizer boundary, canonical planner route and project reconciliation.
- Clean organism runtime, HTTP server and security, and restart-persistence smoke tests.
- `docker compose config --quiet`, real three-service container build/boot, gateway HTTP 200, `/api/health` with `ready=true`, and cognitive architecture response with `validation.ok=true`.

The CI test also confirms the application server, canonical runtime and reverse proxy communicate via the one-origin API path. It does not assert that an external generative model, voice engine or Live2D renderer is configured.

## Learning evidence and limits

The P26 retention results are deterministic synthetic regression results, not a production learning-quality score or evidence of generalized skill improvement on independent real-world tasks. The built-in runtime does not configure a trusted independent holdout verifier by default; therefore it correctly refuses to count new holdout claims as authenticated generalization evidence until a host-owned verifier is actually wired and deployed. This is safer than silently converting self-report into ground truth, but deployment of that evaluator remains open work.

## Release boundary

- `main` is untouched; PR #129 remains draft.
- The current GitHub Release ZIP is still `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (WorkPass70). This source branch was **not** repackaged into that binary asset and no release upload is claimed.
- External Gemini/local-model credentials, voice engines, camera resources, Live2D/browser/audio end-to-end behavior, host-isolated independent evaluator, target-device soak and licensing completeness remain release gates.
