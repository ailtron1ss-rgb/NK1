# WorkPass74 — local LLM selection integration (2026-10-19)

## Goal
Make the configured local llama.cpp model the first-choice language backend in the real server request path, rather than merely adding a provider that is reached only after other backends fail.

## Finding
`runtime/neuro-kurisu/src/server/server.mjs` already constructs `LLAMA_CPP_PROVIDER` from `LLAMA_CPP_URL` and calls it from the generation fallback chain. However, the first-choice backend was selected only by `runtime.core.p40SelectModel(...)`. The default P40 ecology profile for `llama.cpp` is deliberately `configured:false, available:false`, and this server path did not configure that profile. As a result, a valid `LLAMA_CPP_URL` could be present while P40 still chose another backend first.

## Implementation
- Added `src/server/local-language-backend-policy.mjs`, a small deterministic policy function: a configured local llama.cpp endpoint becomes first choice; otherwise the P40 ecology decision is retained.
- Wired the policy into `server/server.mjs`. Existing provider failure handling and fallback ordering remain in place, so a bad local endpoint does not prevent fallback to other configured providers.
- Added `tests/local-llm-selection-workpass74.mjs` with four cases covering configured-local priority, no-config ecology preservation, deterministic degraded fallback distinction, and avoiding bypass of a configured local model.
- Added the regression to `.github/workflows/workpass71-validation.yml`.

## Evidence status
- **IMPLEMENTED:** server request routing now consults the local-first policy when `LLAMA_CPP_URL` is configured.
- **TEST ADDED:** four deterministic policy assertions are wired into the validation workflow.
- **CI UNKNOWN until observed:** a GitHub Actions run on the resulting head must pass before this pass is called validated.
- **NOT PROVEN:** real llama.cpp inference, response quality, model warm/cold start, restart recovery, long-duration stability, and measured device resource use.
- **KNOWN FOLLOW-UP:** P40 ecology's internal selected-profile telemetry may still reflect its recommendation rather than the server's local-first override. Future integration should reconcile actual backend selection into the canonical ecology without falsely marking an unprobed endpoint healthy.

## Reproduction
```sh
node runtime/neuro-kurisu/tests/local-llm-selection-workpass74.mjs
node --experimental-strip-types runtime/neuro-kurisu/tests/local-chat-provider-workpass40.mjs
npm --prefix runtime/neuro-kurisu run typecheck
```

## Scope boundary
This is a concrete language-routing improvement, not a claim that the entire digital organism is complete or conscious. Identity continuity, memory uplift on independent holdouts, online learning/anti-forgetting, action postcondition reconciliation, audio/Live2D E2E, and target-device soak remain separate evidence gates.
