# WorkPass79 handover — local language reliability and rebuild continuation

**Date:** 2026-10-20  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Working branch:** `workpass79-cognitive-rebuild`  
**Base:** `workpass70-source`  
**Status:** WorkPass79–81 implementation and focused regressions committed; Actions run 39371651412 passed all four workflow steps on the code state before this evidence-only documentation update.

## Mission and constraints

Continue NeuroCore as one cohesive, genuinely functional cognitive runtime, with Makise Kurisu as the intended identity direction. This pass is intentionally a small behavioral reliability slice, not a claim that the full architecture has been rebuilt. Keep one canonical owner per capability; no decorative parallel systems, fake metrics, or unsupported consciousness claims.

## Work completed

1. Added `runtime/neuro-kurisu/tests/workpass79-local-language-backend-policy.mjs`.
   - Tests local-provider preference while configured/healthy.
   - Tests cooldown entry after a llama.cpp failure, expiry boundary and bounded exponential backoff.
   - Tests that unrelated-provider failures do not alter local-provider failure state.
   - Tests successful actual local-backend attribution resets the circuit breaker.
   - Tests behavior when local provider is not configured.
2. Added `runtime/neuro-kurisu/tests/workpass79-local-provider-boundary.mjs` for the actual `OpenAICompatibleLocalChatProvider` interface: backend/model attribution, output/temperature bounds, 503, malformed JSON, empty output, 2 MiB response cap, timeout signal and loopback-only URL policy.
3. Added runtime scripts `test:workpass79:local-language-policy`, `test:workpass79:provider-boundary`, and aggregate `test:workpass79` (policy + provider boundary + existing server HTTP smoke).
4. Added `.github/workflows/workpass79-cognitive-regression.yml` to run the policy regression, provider-boundary regression and existing server HTTP smoke with a controlled local provider.
5. Updated `CHANGELOG.md`.

## Commits

- `ada83bd29247e6b4a2652bf3187b462199ed5789` — [NK1][этап1] тесты отказоустойчивости локального LLM
- `efe012e630157042ef1991eabdac3bab015811c8` — [NK1][этап1] подключить регрессию circuit breaker в scripts
- `a60efa382252fa2ba84384e1360373a2a2d7447e` — [NK1][этап1] добавить CI для устойчивости языкового контура
- `56e5bec36c8e7e74161255180225252a1d3f9003` — [NK1][этап1] зафиксировать изменения WorkPass79 в changelog

## Verification ledger

- **IMPLEMENTED:** focused test and CI workflow exist on this branch.
- **UNRESOLVED:** tests were not executed by the GitHub file/commit API. Do not report them as passing until the Actions run confirms the current branch head.
- **UNRESOLVED:** controlled fake-provider HTTP smoke does not establish quality or performance of real llama.cpp inference.
- **UNRESOLVED:** no Dell G3 live inference, memory holdout, learning-transfer benchmark, full production build, real browser/Live2D/TTS E2E, mobile profiling, soak, SBOM/license review or rollback test was run in this pass.
- **No score change:** no global readiness or cognitive capability score should be raised on the basis of adding a regression.

## Immediate next actions

1. Open/inspect the PR and verify the latest WorkPass79 Actions run against its exact head SHA.
2. If the policy regression or HTTP smoke fails, fix the underlying behavior and add/adjust a regression; do not weaken assertions to obtain green CI.
3. Expand the provider integration matrix with HTTP 503, timeout, malformed JSON, cancellation, cooldown expiry, recovery and duplicate/in-flight request cases. Keep local-model output bounded and provider identity tied to the backend that actually answered.
4. Inspect the runtime provider call path for request cancellation propagation and restart behavior; add process-level tests for an in-flight request and prove no stale state or duplicated side effect.
5. On the Dell G3, execute the existing live llama.cpp smoke procedure and record exact model hash, quantization, context, server build, GPU layers, cold/warm latency, resource usage and bounded output.
6. Run independent RU/EN memory holdouts and transfer/forgetting controls. Previous documented `recallDelta=0` means no retrieval uplift claim is allowed.
7. Continue from the next highest-risk canonical runtime path, not by adding disconnected modules.

## Rollback

The change is additive. Revert the WorkPass79 commits or remove the workflow/script/test additions if they prove unstable; do not alter the existing canonical provider policy solely to satisfy the new test without a reproduced defect.


## WorkPass80 — cold-memory retrieval invariant

1. Added `tests/workpass80-memory-residency-retrieval.mjs` with 140 deterministic records. The fixture makes an older, low-salience record cold, confirms lexical recall still returns it, and checks retrieval does not re-materialize its vector or promote its residency tier.
2. Added snapshot/restore assertions, candidate budget <=192, and canonical index integrity checks.
3. Added `test:workpass80:memory-residency` and aggregate `test:workpass80`; wired the focused regression into `.github/workflows/workpass79-cognitive-regression.yml`.
4. **IMPLEMENTED, not yet VERIFIED:** the regression is committed but must pass Actions on the current head before being marked PASS. The fixture does not establish semantic retrieval uplift; independent RU/EN holdout, Recall@k/MRR comparison to BM25, transfer/forgetting tests, and real local-model inference remain open.

## Current verification gate

- Run `39371651412` completed successfully: cold-memory retrieval, local-backend policy, provider boundary (including timeout and caller cancellation), and server HTTP smoke all PASS. Job logs explicitly show `WORKPASS80_MEMORY_RESIDENCY_RETRIEVAL=PASS`, `WORKPASS79_LOCAL_LANGUAGE_BACKEND_POLICY=PASS`, `WORKPASS79_LOCAL_PROVIDER_BOUNDARY=PASS`, and `SERVER_SMOKE=PASS`.
- The GitHub content/commit API does not execute tests locally; the evidence above comes from GitHub Actions. Documentation-only commits after that run do not change the tested source, but a final head check is still recommended.


## WorkPass81 — cancellation at the local provider boundary

- `LocalChatCompletionRequest` now accepts an optional caller `AbortSignal`. The provider composes it with its own deadline using `AbortSignal.any`, rejects already-cancelled work before dispatch, and normalizes cancellation/deadline failures.
- Boundary tests cover in-flight caller abort and pre-aborted requests, in addition to the existing deadline test.
- **IMPLEMENTED, not yet VERIFIED:** test execution must be confirmed by Actions. This change only guarantees cancellation propagation when an upstream caller passes a signal; audit the actual cognitive-cycle call chain before claiming end-to-end cancellation. Real llama.cpp and restart/recovery tests remain open.


## CI finding and test-harness correction

- Run `39371576041` confirmed WorkPass80 cold-memory regression and WorkPass79 policy regression **PASS**. The provider-boundary step failed with Node exit code 13 at the timeout test because the test awaited Node's unreferenced `AbortSignal.timeout()` timer without keeping the process alive.
- The focused timeout test now holds the process open for up to one second, asserts the normalized timeout error, and clears its keep-alive timer in `finally`. This preserves the timeout assertion rather than skipping it. The follow-up Actions run is still required before provider cancellation/timeout coverage is marked PASS.


## Verified CI evidence — WorkPass80/81

- Run: https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412
- Result: **PASS** (Node v22.23.3, npm 10.9.9).
- Cold memory: corpus 140; tiers 16 hot / 64 warm / 60 cold; materialized vectors 80 before and after retrieval; target recalled before and after restore; 140 candidates; index integrity true.
- Local provider: success path, HTTP 503 normalization, malformed JSON, empty output, 2 MiB response cap, timeout abort, caller cancellation, loopback-only endpoint policy all PASS.
- Server HTTP smoke: PASS.
- Still not covered by this CI: live llama.cpp on Dell G3, caller signal propagation from the whole cognitive cycle, restart/recovery under a real process, independent bilingual Recall@k/MRR benchmark, learning transfer/forgetting, browser/Live2D/TTS E2E, clean install/rollback, and soak testing.
