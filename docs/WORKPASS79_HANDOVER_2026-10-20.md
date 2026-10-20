# WorkPass79 handover — local language reliability and rebuild continuation

**Date:** 2026-10-20  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Working branch:** `workpass79-cognitive-rebuild`  
**Base:** `workpass70-source`  
**Status:** implementation committed; runtime tests and Actions not yet observed from this session.

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
