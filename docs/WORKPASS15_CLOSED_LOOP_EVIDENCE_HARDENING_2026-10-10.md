# WorkPass 15 — Closed-loop evidence hardening

**Date:** 2026-10-10  
**Base:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS14_2026-10-10.zip`  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Status:** implementation workpass; not release-ready.

## Implementation delivered

1. `RuntimeEvidenceBus` now assigns deterministic monotonic IDs, validates `kind`/finite non-negative `tick`, bounds payload depth/keys/arrays/strings and total payload size, normalizes/deduplicates causal parents, detaches emitted/returned values from caller references, and restores malformed/legacy snapshots defensively.
2. Evidence bus counters now distinguish lifetime totals and `byKind` from the retained-buffer window (`bufferedByKind` / buffered count). Old snapshots without sequence metadata remain readable. Capacity and counters are normalized on restore.
3. `OutcomeVerificationService` passes a structured-cloned, deeply frozen verifier view instead of mutable live `input`/`result` references. Verifier errors, unserializable contexts, unsupported bases, empty external observation receipts and invalid claims fail closed to `unverified`; evidence text fields are bounded and raw verifier exception details are not surfaced.
4. Added `big-pass-128` evidence bus stress and malformed-state regressions, `big-pass-129` outcome-verification adversarial regressions, and server-smoke polling tests. Updated root/runtime package aliases and release metadata.
5. Server smoke startup is bounded by an overall deadline, per-probe timeout and child-exit awareness. Cleanup waits a bounded interval, then escalates termination. The child runtime working directory is derived from `import.meta.url`, not the shell caller’s CWD, so the root-level aggregate gate launches the proper server. This prevents an unavailable server from leaving a long, unbounded readiness loop.
6. Reconciled current normalized task inventory and weighted scorecard. Previous historical task tables remain append-only and are not summed. Current inventory: 45 deliverables (28 DONE, 9 PARTIAL, 8 TODO); weighted implementation estimate 68.50% (previous official 67.95%). This remains distinct from release readiness.

## Verification actually observed

- `npm run audit:release-metadata`: 33/33 checks passed.
- `npm run test:release-metadata-contract`: 6/6 passed, including negative fixtures.
- `npm run test:app:scripts`: 203/203 passed.
- `npm run test:browser-smoke-verdict`: 46/46 passed.
- `npm --prefix runtime/neuro-kurisu run typecheck`: `TYPECHECK=PASS mode=tsc`.
- `npm run test:server-smoke-poll`: passed.
- Runtime evidence bus reliability, outcome verification hardening, reafference codec/integration, agency affordance, targeted temporal-credit, memory retrieval benchmark and offline experiment tests passed individually.
- Server imports: 10 checked, 0 missing.
- Static UI/API linkage: 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, no missing links.
- Asset audit: no missing/invalid required Live2D/sprite assets.
- Direct `node --experimental-strip-types runtime/neuro-kurisu/tests/server-smoke.mjs`: `SERVER_SMOKE=PASS`; exercised real HTTP chat and the listed diagnostic/integration routes.
- The first chained audit exposed a caller-CWD assumption in `server-smoke.mjs`; this was fixed by resolving the runtime root from `import.meta.url`. The full chained audit was then rerun to verify the root-level invocation, rather than counting the initial failed run as successful.

## Remaining blockers

- Root/app dependency-complete semantic typecheck and React/Vite production build: still blocked by unavailable/incomplete UI dependencies; npm registry access has returned DNS `EAI_AGAIN`.
- Desktop/mobile browser E2E, including real Live2D interaction.
- Independent labeled temporal MemoryOS2 holdout and real-corpus uplift evidence; synthetic fixtures prove harness behavior only.
- End-to-end external action → remote receipt/postcondition → persistence → reafference, reconnect/replay stress and no-double-credit tests.
- Clean-room restore/upgrade/rollback, multi-hour soak, SBOM/license inventory and immutable provenance sign-off.

**Conclusion:** this pass materially hardens evidence ingestion, verification boundaries and CI timeout behaviour. It does not claim external exactly-once semantics, full UI completion, production memory uplift or release readiness.
