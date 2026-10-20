# WorkPass79 handover — local language reliability and rebuild continuation

**Date:** 2026-10-20  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Working branch:** `workpass79-cognitive-rebuild`  
**Base:** `workpass70-source`  
**Status:** WorkPass79–82 implementation and focused regressions committed. WorkPass79–81 passed in run 39371651412; WorkPass82 and the full four-test CI sequence passed in run 39372093088.

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


## WorkPass82 — HTTP disconnect to upstream local-model cancellation

- `/api/organism/chat` now creates a request-scoped controller and aborts it on `req.aborted` or a premature response `close`; the controller is passed into `runtime.step`.
- `OrganismRuntime` attaches the optional signal to both cognitive-proposal and response-generation language requests. Caller cancellation does not count as a model failure or force the runtime to fabricate a language result.
- Server provider selection composes the caller signal with deadlines and stops provider fallback after cancellation; local llama.cpp receives the caller signal.
- Added `tests/workpass82-server-language-cancellation.mjs`, which runs a real NK1 server and a deliberately non-responsive loopback provider, then checks that destroying the chat client closes the upstream provider connection before the provider timeout.
- **PASS:** Actions run [39372093088](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372093088) reports `WORKPASS82_SERVER_LANGUAGE_CANCELLATION=PASS` with one provider request and one observed upstream disconnect; provider boundary, memory residency, policy and server smoke also passed. This controlled test does not prove a real llama.cpp process recovers correctly after restart, nor that Android/browser clients are covered.


## Verified WorkPass82 Actions evidence

- Run: https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372093088 — job conclusion **success**.
- `WORKPASS80_MEMORY_RESIDENCY_RETRIEVAL=PASS`: 140 records, 60 cold, materialized vectors unchanged at 80, target recall before/after restore, index integrity true.
- `WORKPASS79_LOCAL_LANGUAGE_BACKEND_POLICY=PASS`: 12 policy assertions.
- `WORKPASS79_LOCAL_PROVIDER_BOUNDARY=PASS`: bounded output, 503/malformed/empty/size cases, timeout abort, caller cancellation, loopback-only endpoint.
- `WORKPASS82_SERVER_LANGUAGE_CANCELLATION=PASS`: controlled local provider received one request and its socket closed when the client disconnected, before the 12-second timeout.
- `SERVER_SMOKE=PASS`: existing server HTTP smoke also passed.


## WorkPass83 — retrieval benchmark truthfulness and holdout leakage

- Added `tests/workpass83-retrieval-benchmark-truth.mjs` and `test:workpass83:retrieval-benchmark-truth`.
- Fixture: 12 synthetic memories (English and Russian), 4 train queries, 8 holdout queries. The test runs the existing MemoryOS2-vs-Okapi-BM25 harness, checks stable metric shape and promotion-gate/status consistency, verifies the live memory snapshot remains unchanged, and confirms duplicated normalized prompts crossing train/holdout block promotion.
- **PASS:** Actions run https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372815361. Log: `WORKPASS83_RETRIEVAL_BENCHMARK_TRUTH=PASS`, baseline/candidate Recall@3 = 1.0, baseline/candidate MRR = 1.0, liveMemoryMutated=false, crossSplitLeakageBlocksPromotion=true. Other WorkPass79/80/82 checks and `SERVER_SMOKE` also passed.
- Interpretation: the synthetic fixture is deliberately easy; equal 1.0 scores mean **zero observed uplift**, not proof that semantic retrieval improved. It validates the experiment harness and guardrails only.
- Next: use a versioned independent RU/EN labelled holdout, pre-register relevance labels and split rules, compare Recall@k/MRR and paired confidence intervals against BM25; then test actual llama.cpp on Dell G3, process restart/recovery, transfer/anti-forgetting and soak. Keep the PR draft until these are evidenced.


## WorkPass84 — script-target integrity guard (2026-10-20)

- Added `tests/workpass84-script-integrity.mjs` and npm entry `test:workpass84:script-integrity`; added it as an explicit step in `.github/workflows/workpass79-cognitive-regression.yml`.
- The first manifest scan found and corrected three broken script aliases: `audit:pass98:long` now calls `test:long-horizon:operational:1000`; `audit:reality-fast` calls `test:big-pass-317:reality`; `test:p2853` uses the existing canonical `test:p2850:neural-continuity` target.
- The guard validates every `npm run` target declared inside runtime package scripts and every static local `tests/*` source path referenced there. It is deliberately conservative: it does not claim that every script passes, that dynamic imports are complete, or that the project is release-ready.
- Manifest preflight after fixes: 1,655 scripts, 3,334 npm-run references, 1,286 static test-file references, zero missing script targets in the preflight parser. GitHub Actions on the new head is the authoritative execution evidence and is still pending at time of this note.
- Next: verify the new CI run; then inspect high-risk restart/recovery and learning/retention paths, and build the independent RU/EN retrieval holdout. Do not raise cognitive-readiness scores from an integrity guard alone.


## Research handoff — independent memory/learning quality gates

Read `docs/RESEARCH_GATE_MEMORY_CONTINUAL_LEARNING_2026-10-20.md` before changing retrieval or learning algorithms. It records research links and translates them into concrete gates:

- LongMemEval: extraction, multi-session/temporal reasoning, knowledge updates and abstention.
- MemoryAgentBench: retrieval, test-time learning, long-range understanding and selective forgetting.
- MemBench: factual/reflective memory plus effectiveness, efficiency and capacity.
- Memora/FAMA: explicitly penalize reliance on obsolete facts.
- FOREVER: test forgetting-aware replay scheduling as an ablation; do not assume its training method transfers directly.
- Modular memory and Titans: candidates, not approved architecture changes until resource and ablation evidence exists.

No external benchmark data or code has been copied into NK1. Verify licences and data provenance before importing. Next quality pass should extend the existing benchmark harness to a versioned manifest and independent RU/EN holdout, including stale-fact, temporal-update and abstention metrics; preserve the synthetic WorkPass83 fixture strictly as harness validation. The WorkPass84 CI guard and latest successful run are recorded below in the verification ledger.
