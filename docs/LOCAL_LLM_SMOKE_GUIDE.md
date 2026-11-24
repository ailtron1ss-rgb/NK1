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
