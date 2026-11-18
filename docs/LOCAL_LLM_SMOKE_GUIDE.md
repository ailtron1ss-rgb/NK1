# NeuroCore local LLM smoke test

This is a deliberately small live transport smoke, not a model-quality benchmark. It tests the existing canonical `OpenAICompatibleLocalChatProvider`; it does not download a model, change model settings, or send prompts to a remote service.

## Run on the Dell G3

1. Start a local `llama-server` (or a compatible local OpenAI-style server) yourself. Confirm its actual listening port and that its chat-completions endpoint is `/v1/chat/completions`. Do not assume an application's UI port is also its model-server port.
2. Open PowerShell in the repository's `runtime/neuro-kurisu` directory.
3. Set the loopback base URL and, optionally, the model name that the local server expects:

```powershell
$env:LLAMA_CPP_SMOKE_URL = "http://127.0.0.1:PORT/v1"
$env:LLAMA_CPP_SMOKE_MODEL = "local-model"
$env:LLAMA_CPP_SMOKE_TIMEOUT_MS = "30000"
$env:LLAMA_CPP_SMOKE_RUNS = "3"
node --experimental-strip-types tests/local-llm-live-smoke.mjs
```

Replace `PORT` with the actual local model-server port. If the server accepts a model alias, use that alias; if it reports a different model identifier in responses, the smoke records the actual backend identifier.

To use a PowerShell one-liner after setting the variables:

```powershell
node --experimental-strip-types tests/local-llm-live-smoke.mjs
```

## Result interpretation

- `LOCAL_LLM_LIVE_SMOKE=SKIP`: no explicit `LLAMA_CPP_SMOKE_URL` was provided. This is the intended default in CI.
- `LOCAL_LLM_LIVE_SMOKE=PASS`: all requested requests returned non-empty text through the loopback provider. Output records requested/actual backend, cold first latency, median and p95 for the small sample, and output character counts. Prompt and generated text are not logged.
- A timeout, non-2xx response, invalid JSON, empty output or non-loopback URL is a failure to investigate, not a reason to disable the test.

The provider intentionally rejects non-loopback hosts. Do not weaken that boundary just to make a remote endpoint pass this local smoke. For real comparisons, record the exact model file/hash, quantization, context, GPU layers, server version, cold/warm runs and system resource usage separately.

**Evidence limit:** a successful smoke proves only that the local HTTP inference path responds. It does not establish answer correctness, Russian/English quality, learning, memory uplift, stable long-context reasoning or consciousness.

## Optional NK1 cognitive-template controls

The NK1 runtime can optionally forward a compact, bounded subset of the Cognitive-to-Neural Bridge v2 profile through llama.cpp's documented `chat_template_kwargs` field. Enable it in the **server process** only when using a custom Jinja chat template that explicitly reads the `nk1_*` variables:

```powershell
$env:LLAMA_CPP_NK1_TEMPLATE_CONTROLS = "1"
```

Unset or set the variable to any other value to keep the feature off. With the opt-in enabled, the server sends the 43-value profile plus named action/mode, motivation, uncertainty, budget, freshness and bounded steering-intent fields. The actual chat template must explicitly consume those variables; the default template may ignore them. The receipt exposed by NK1 means only that `chat_template_kwargs` was sent to the local endpoint, not that the template used it or that model activations were steered.

This flag does not enable changes to model weights, hidden states, or residual activations. Keep the default off unless the selected template has been adapted and tested with the NK1 variables.

The bridge accepts only the B365 v14 diagnostic schema, a valid state tick, and all 23 neural/allostatic/self-model/goal-authorship signals as finite normalized values. Unknown B365 versions, partial, future or more-than-eight-tick-old snapshots are rejected as a whole and marked unavailable; they are never mixed with partial readings. The provider repeats semantic validation of the 43-channel schema, one-hot fields, adapter hint, provenance and freshness; it also recomputes temperature, maxTokens and every steering intent from the vector before forwarding template kwargs. Bounded but semantically inconsistent controls are rejected.

### Runtime diagnostics

The running server exposes an authenticated, read-only counter view. PowerShell example:

```powershell
curl.exe -H "Authorization: Bearer $env:NEURO_API_TOKEN" `
  http://127.0.0.1:3000/api/organism/cognition/neural-bridge/diagnostics
```

Inspect `diagnostics.projected`, `diagnostics.bypassed`, B365 snapshot counters/version/age, `diagnostics.lastFeatureDimensions`, `diagnostics.llamaCppTemplateKwargsSent`, accepted/rejected/duplicate receipt counters, and provider token-usage counters. Every request receives a runtime-session-scoped ID. Before invoking the async provider, NK1 retains that ID, the SHA-256 fingerprint, schema, tick and max-token budget in a runtime-private WeakMap bound to the exact request object. The local adapter returns the ID and profile fingerprint; NK1 rejects post-invocation mutations, stale/mismatched receipts and duplicate receipts using a bounded 512-entry replay ledger. The fingerprint binds the receipt to the pre-invocation profile but does not independently authenticate the provider. When llama.cpp returns valid `usage.prompt_tokens`, `usage.completion_tokens` and `usage.total_tokens`, NK1 records totals plus mean/max completion-budget utilization and any over-budget completions. Usage accounting has its own bounded 512-request replay ledger and works independently of the optional template-controls flag. Missing/invalid usage, missing request IDs and duplicate observations stay separately counted; token volume is resource telemetry, not answer-quality evidence. The response explicitly keeps `templateConsumptionVerified=false`, `activationSteeringApplied=0`, and `residualBlockApplied=0`: transport success is not evidence of Jinja consumption or neural/quality effects. The endpoint does not return prompts or memory contents.

### Illustrative Jinja insertion

Do not replace a model's whole chat template with this fragment. Insert it inside the **existing system-message branch** of a tested template, before rendering that system message's content:

```jinja
{%- if nk1_control_version | default(0) == 2 %}
{{- '\n[NEUROCORE CONTROL]' -}}
{{- '\nmode=' ~ (nk1_mode | default('shallow')) -}}
{{- '\naction=' ~ (nk1_action | default('none')) -}}
{{- '\nuncertainty=' ~ (nk1_uncertainty01 | default(0.5)) -}}
{{- '\nbudget=' ~ (nk1_budget_remaining01 | default(0.5)) -}}
{{- '\nneural_freshness=' ~ (nk1_neural_snapshot_freshness01 | default(0)) -}}
{%- endif %}
```

This example renders a small text summary into the model's system context. It is **not** neural activation steering: it gives the model structured context through its prompt template. Keep the control values out of untrusted user input and test the exact model template before enabling the server flag.
