# NK1 local small-model integration — 2026-10-24

## Purpose

Unify the local model surfaces used by Neuro Kurisu without treating unlike models as interchangeable. The first integration layer is `LocalSmallModelHub`: a bounded task registry, privacy-safe diagnostics, strict specialist output contracts, and one shared embedding provider for both canonical memory retrieval and the server API.

This is an incremental runtime integration, not a claim that every neural subsystem has been replaced by a learned model. Deterministic fallbacks remain available, and configured endpoints are not considered healthy until real inference succeeds.

## Model roles

| Role | Transport | Capabilities | State semantics |
|---|---|---|---|
| Main language model | Existing local `llama.cpp` OpenAI-compatible adapter | Text generation, reasoning/planning prompts, skill-revision generation | Local-first policy; existing circuit breaker retained |
| Memory embeddings | Shared `LocalEmbeddingProvider` | Semantic memory indexing and retrieval, direct batch embeddings | Shared cache/diagnostics between `MemorySubsystemRuntime` and the hub |
| Intent/classification | Optional loopback `/v1/chat/completions` model | Bounded label selection with confidence validation | Disabled when `NK_LOCAL_CLASSIFIER_URL` is absent |
| Affect estimate | Optional loopback `/v1/chat/completions` model | Emotion label, valence, arousal, confidence, all schema-checked | Disabled when `NK_LOCAL_EMOTION_URL` is absent |

The classifier and affect model use bounded JSON contracts. Invalid outputs are rejected; specialist results are fallible hints and cannot override the user message or system policy. The model hub records decision metadata and aggregate request/latency/failure metrics, never the input prompt or model output text.

## Integration points

- `runtime/neuro-kurisu/src/server/LocalSmallModelHub.mjs` owns capability metadata, task dispatch, schema checks and safe counters.
- `runtime/neuro-kurisu/src/server/server.mjs` sends language selection/completion accounting through the hub. If a specialist model is configured, its validated low-confidence signal can be attached to the language-response system context; the original user text remains intact.
- `MemoryOS2` exports `sharedLocalEmbeddingProvider`. The canonical `MemorySubsystemRuntime` and the server's embeddings endpoint share this exact provider instance, so they also share its bounded vector cache and diagnostics instead of opening independent provider caches.
- Existing memory retrieval remains canonical: real local embeddings enrich the derived semantic index, while provider failure falls back to the existing lexical/fuzzy/graph path. Vectors are not a second source of canonical memory facts.
- `GET /api/local-models` reports configured capabilities and privacy-safe operational state.
- `POST /api/local-models/embeddings` accepts 1–32 non-empty strings, max 2,400 characters each.
- `POST /api/local-models/classify` accepts one text string (max 4,000 characters) and an optional bounded label list.
- `POST /api/local-models/emotion` accepts one text string (max 4,000 characters); its response explicitly identifies affect as an uncertain estimate, not a diagnosis.

These routes use NK1's existing `/api/` authorization gate and rate limiting.

## Configuration

Configure only the local processes you actually run. NK1 does not download model weights or start external inference servers automatically.

```dotenv
# General-purpose local generation (existing adapter; loopback only)
LLAMA_CPP_URL=http://127.0.0.1:8080/v1
LLAMA_CPP_MODEL=your-local-chat-model

# Embeddings for canonical memory and the hub API
NK_EMBEDDINGS_ENABLED=1
NK_EMBEDDINGS_PROVIDER=ollama
NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:11434
NK_EMBEDDINGS_MODEL=embeddinggemma

# Optional specialist models; provide separate local endpoints if separate models are needed
NK_LOCAL_CLASSIFIER_URL=http://127.0.0.1:8081/v1
NK_LOCAL_CLASSIFIER_MODEL=your-small-classifier-model
NK_LOCAL_EMOTION_URL=http://127.0.0.1:8082/v1
NK_LOCAL_EMOTION_MODEL=your-small-affect-model
NK_LOCAL_SPECIALIST_TIMEOUT_MS=15000

# Specialist signals are used only when the corresponding endpoints are configured
NK_LOCAL_CONTEXT_SIGNALS_ENABLED=1
```

The current default embedding backend is local Ollama at `127.0.0.1:11434` with model `embeddinggemma`. A local OpenAI-compatible embeddings endpoint can instead be selected with `NK_EMBEDDINGS_PROVIDER=openai-compatible` and `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:8080/v1`.

Remote embeddings are blocked by default. They require explicit `NK_EMBEDDINGS_ALLOW_REMOTE=1` and HTTPS. The classifier and affect chat adapters enforce loopback-only HTTP; a remote URL is rejected by the existing local-chat provider. The embedding sanitizer removes common credential/contact patterns, but it is a heuristic, not a universal PII detector.

Set `NK_LOCAL_CONTEXT_SIGNALS_ENABLED=0` to disable specialist calls from the language-response path while retaining the diagnostics and explicit specialist API routes.

## Diagnostics and limits

- `not-configured`: the role has no configured adapter.
- `configured-unprobed`: configuration exists but this process has not yet observed a successful inference.
- `observed-healthy`: at least one successful inference has been observed by the current process or, for embeddings, by the shared provider.
- The hub snapshot does not perform network probes, include credentials, or retain prompts.
- Chat model transports have a bounded response size and timeout; embedding requests are batched and cached with existing provider limits.
- If a configured model is offline, the specialist API returns a bounded error and the main cognitive response path continues without the optional signal.
- The memory's deterministic retrieval path remains available when embeddings fail; semantic enrichment is best-effort and derived.

## Validation status

A dedicated regression test covers local-first routing/cooldown, strict classification and affect schemas, prompt redaction, embedding batch caps, shared memory-provider configuration, bounded diagnostics, context-signal degradation and malformed model output rejection. The test is registered in the runtime package and WorkPass71 CI.

**Do not treat this document or a configured endpoint as proof of model quality.** The suite still needs to execute successfully on the exact branch; actual device inference, latency/RAM measurements, retrieval uplift against an untouched holdout, and long-soak behavior remain separate validation gates.
