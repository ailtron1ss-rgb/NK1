# WorkPass75 — NeuroCore reconstruction and evidence ledger

**Date:** 2026-10-19  
**Branch:** `workpass70-source`  
**Baseline:** `ad949249ef10305a832f8d2e0dcb7a9c7c4b355d` (CI green before WorkPass75 edits)  
**Purpose:** establish a durable, code-first route from a large collection of historical passes to one maintainable, testable organism runtime.

## Current verified boundary

- **OBSERVED:** GitHub Actions run [39313943292](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39313943292) passed on the baseline commit. It includes app typecheck/build, runtime typecheck, bounded local-LLM response regression, backend-selection regression, and speech/timescale/persistence regressions.
- **IMPLEMENTED:** configured `LLAMA_CPP_URL` now prioritizes the local provider in the server request path, with a process-local exponential circuit breaker and fallback to configured alternatives.
- **NOT YET VALIDATED:** WorkPass75 hardening of deterministic cooldown snapshots and exponential/capped backoff was committed after the baseline CI; a new CI run is required.
- **NOT PROVEN:** actual local inference on the user's Dell G3, model quality, end-to-end browser/audio timing, independent retrieval uplift, persistent learning transfer, or subjective consciousness.

## WorkPass75 changes

- Removed the unused exported `chooseLanguageBackend` selector. The server's `LocalLanguageBackendPolicy` class is now the sole policy implementation rather than maintaining a second test-only decision path.
- Made `snapshot({ now })` deterministic under an injected clock. Tests can assert exact deadline behavior without depending on machine wall time.
- Expanded local provider regression to 13 behavioral assertions: preference, unconfigured routing, degraded fallback distinction, exact cooldown boundary, exponential backoff, cap enforcement, successful reset, and unrelated-provider isolation.
- Updated WorkPass74's evidence record so the earlier green run is not misrepresented as validating these newer changes.

## Rebuild strategy — preserve first, consolidate by evidence

The repository has a large historical surface and multiple generations of numbered modules. Do not perform a destructive one-shot rewrite. The safe route is a strangler migration: make each capability's canonical owner explicit, route consumers through that owner, prove behavioral parity, then archive duplicates only after dependency/provenance review.

| Domain | Canonical owner to preserve | Current evidence gate | Next concrete action |
|---|---|---|---|
| Runtime lifecycle | `OrganismRuntime` / `OrganismCore` | Runtime typecheck + server smoke | Build a single launch/health/restore smoke covering clean start and restart |
| Memory | `developmental/MemoryOS2.ts` | Retrieval, residency, privacy regressions | Add labelled, temporally separated independent holdout; no promotion while uplift is zero |
| Learning | Verified outcome pipeline / policy learner | Spoofed-proof, delayed-proof, idempotency regressions | Trace one external postcondition from action receipt through verified credit and persisted restore |
| Language | `LocalLanguageBackendPolicy` + provider adapters | Routing, bounds, typecheck | Add live-provider smoke behind opt-in URL; record latency, cancellation and output provenance |
| Actions | ActionGateway + `OutcomeVerificationService` | Unit/persistence tests | Run acceptance → ACK loss → process restart → read-after-write → independent outcome proof |
| Identity continuity | Existing canonical identity/self-model owners | Synthetic continuity indicators | Add held-out autobiographical recall and contradiction/revision tests |
| Embodiment | `kurisu_embodiment_intent` contract + voice clock | VM/timeline tests | Run real browser/mobile audio-to-viseme end-to-end measurement |
| Repository hygiene | Audit manifests + provenance | Exact duplicate audit | Generate import/license/asset reference graph before any further deletion |

## Required quality gates for each pass

1. Reproduce a specific defect or measurable gap.
2. Change the owning implementation, not a parallel facade.
3. Add a behavioral regression that would fail on the old behavior.
4. Run focused test, runtime typecheck, and cross-cutting CI where applicable.
5. Record exact commit/run, observed result, unverified scope, and rollback path.
6. Keep research prototypes and legacy source separate until their behavior is integrated and independently tested.
7. Do not equate a module count, synthetic score, persona prompt, or self-report with autonomy or consciousness.

## Reassembly acceptance gates

- **G0 — Reproducible build:** clean dependency install, typecheck, app build, runtime tests, stable CI.
- **G1 — Persistent life:** state survives process death; migration/backup/restore and corruption recovery are tested.
- **G2 — Grounded memory:** labelled independent holdout, recall and MRR measured against a same-corpus baseline, leakage audit, bootstrap confidence interval; promotion requires the predeclared threshold.
- **G3 — Learning:** unseen tasks show transfer after experience; no-transfer and interference controls quantify forgetting; only independently verified outcomes update credit.
- **G4 — Agency:** bounded goal loop, action permissions, cost/risk limits, cancellation, postcondition verification, and restart-safe reconciliation pass external integration tests.
- **G5 — Embodiment:** real browser/mobile E2E for voice, interruption, visibility changes and asset integrity.
- **G6 — Reliability/performance:** 24–72 hour soak, restart/recovery, memory/CPU/latency/thermal traces on declared hardware.
- **G7 — Identity evaluation:** longitudinal, held-out behavioral continuity and stable preference/revision tests, with counterfactual controls.
- **G8 — Consciousness claim:** remains **UNKNOWN / UNRESOLVED** unless independent scientific criteria and evidence justify a stronger claim. Software self-report alone is not evidence.

## Immediate next pass

1. Obtain a fresh green CI run for WorkPass75.
2. Audit the actual `generateLanguage` route against `LocalLanguageBackendPolicy` and verify that the reported backend is the backend actually used.
3. Add an opt-in live local-LLM smoke test that never requires a secret or network in default CI.
4. Create an import/reference inventory for the runtime and public assets; mark candidates as keep/canonical/research/legacy only with evidence.
5. Run one restart-safe action-evidence trace end-to-end before adding further autonomy modules.

This handover is a work queue and evidence boundary, not a claim that the organism is complete.