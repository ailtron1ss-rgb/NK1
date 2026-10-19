# WorkPass73 — bounded local LLM response boundary

**Date:** 2026-10-19  
**Branch:** `workpass70-source`  
**Scope:** local `llama.cpp` chat-provider response handling  
**Status:** implementation committed; GitHub Actions result must be checked before calling this pass CI-validated.

## Defect

`OpenAICompatibleLocalChatProvider.generate()` checked the 2 MiB response cap only after calling `response.text()`. A chunked response with no `Content-Length` could therefore be fully buffered before the cap was enforced. The configured size limit did not bound peak memory during network-body consumption.

## Change

- Read real Fetch response bodies incrementally through `ReadableStreamDefaultReader`.
- Stop reading and cancel the stream as soon as accumulated bytes exceed 2 MiB.
- Retain the `Content-Length` fast rejection and cancel an oversized body before parsing.
- Keep the text-only injected-transport fallback for lightweight test doubles; the actual Fetch Response path uses streaming reads.
- Add a regression for a chunked oversized body without `Content-Length`, including an assertion that the stream is cancelled.
- Add the local chat-provider regression to the active `.github/workflows/workpass71-validation.yml` workflow.

## Commits

- Provider streaming bound: [11c83b3](https://github.com/ailtron1ss-rgb/NK1/commit/11c83b324879ea3069db4721783542ae02594b2d)
- Regression for chunked oversized response: [341f885](https://github.com/ailtron1ss-rgb/NK1/commit/341f885e352cb617bdb7f8c4eb29559ddb33dd2b)
- URL path normalization correction: [f445198](https://github.com/ailtron1ss-rgb/NK1/commit/f44519859f50da62c18517966119e636d59ffc3c)
- CI wiring: [dcfd4b5](https://github.com/ailtron1ss-rgb/NK1/commit/dcfd4b56ef96dc8ff3c844ab234569cf379fcb9f)

## Evidence and limits

- **IMPLEMENTED:** bounded streaming read, immediate cancellation on byte-budget breach, and regression added to CI.
- **NOT YET CI-OBSERVED:** the new workflow run and runtime typecheck after these commits. The GitHub connector exposed commit metadata but did not return a run for the push-triggered commit; do not treat the prior WorkPass72 green run as validation for this patch.
- **NOT CLAIMED:** successful inference against a real downloaded model, production readiness, retrieval uplift, or subjective consciousness.

## Reproduction

From repository root with Node 22.16.0 and runtime dependencies available:

```bash
npm --prefix runtime/neuro-kurisu run typecheck
node --experimental-strip-types runtime/neuro-kurisu/tests/local-chat-provider-workpass40.mjs
```

The test is now part of the active WorkPass71 validation workflow. The next code pass should continue with model-switch/cancellation/restart behavior and only then run the real local inference acceptance test against an installed `llama-server`.
