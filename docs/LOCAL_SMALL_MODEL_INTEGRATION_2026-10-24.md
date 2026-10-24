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
| Affect estimate | Optional loopback `/v1/chat/completions` model | Emotion label, valence, arousal, confidence, all schema-checked | Disabled when `NK_LOCAL_EMOTION_URL` is absent |\n| Visual perception | Local OpenAI-compatible VLM | Bounded image-to-JSON: scene, objects, relations and events | Enabled by `NK_LOCAL_VISION_URL`; loopback HTTP only |

The classifier and affect model use bounded JSON contracts. Invalid outputs are rejected; specialist results are fallible hints and cannot override the user message or system policy. The model hub records decision metadata and aggregate request/latency/failure metrics, never the input prompt or model output text.

## Local vision path

The existing visual-perception contract (`VisionSemanticBackend`) now has a local implementation, `LocalOpenAICompatibleVisionBackend`. It sends an image to a loopback OpenAI-compatible `/v1/chat/completions` endpoint as a data URI, asks for a bounded JSON scene description and normalizes its output before the core perception pipeline receives it.

- `NK_LOCAL_VISION_URL=http://127.0.0.1:8080/v1`
- `NK_LOCAL_VISION_MODEL=your-local-vlm`
- `NK_LOCAL_VISION_TIMEOUT_MS=12000` (bounded to 500–60,000 ms)
- `NK_LOCAL_VISION_MAX_IMAGE_BYTES=8000000` (bounded to 32 KB–12 MB)
- PNG, JPEG, WebP and GIF files are accepted; oversized images and provider responses are rejected before parsing.
- The local VLM is preferred whenever configured. A cloud Gemini fallback is created only when both `GEMINI_VISION_ENABLED=1` and `GEMINI_API_KEY` are present. If local inference fails, the hub records that failure before using the explicitly configured fallback; it never enables cloud use on its own.
- Operational diagnostics record the selected backend and result, not image content or image file paths. Visual labels and confidence values remain model-generated evidence rather than ground truth.

## Affect fusion into the cognitive core

When a configured local affect model is enabled, its validated result enters two bounded paths: it is appended as an explicitly untrusted hint to the language prompt, and it is submitted to the canonical `EmotionAppraisalEngine` through `OrganismCore.observeLocalAffectHint`.

The core accepts only the allowlisted affect label, valence in -1..1, arousal/confidence in 0..1 and a timestamp within a short freshness window. It stores no input text. During appraisal, the fresh signal may blend at most 18% into valence/arousal; the endogenous appraisal still chooses the authoritative emotion label and action tendency. Stale hints expire after 15 seconds, and malformed/restored values are rejected. Thus a tiny model can add a weak cue without taking over cognition or claiming to diagnose a person.

`NEURO_AUTORUN_ENABLED` defaults to `1` and preserves autonomous runtime ticks. Setting it to `0` disables background autonomous ticks for deterministic maintenance/tests; it does not switch the server into this mode by default.

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

Remote embeddings are blocked by default. They require explicit `NK_EMBEDDINGS_ALLOW_REMOTE=1` and HTTPS. The classifier, affect and vision adapters enforce loopback-only HTTP; a remote URL is rejected by the corresponding local adapter. The embedding sanitizer removes common credential/contact patterns, but it is a heuristic, not a universal PII detector.

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

Dedicated regressions cover local-first routing/cooldown, strict classification and affect schemas, prompt redaction, embedding batch caps, shared memory-provider configuration, bounded diagnostics, context-signal degradation, explicit vision fallback and malformed output rejection. A local-vision regression exercises loopback enforcement, multimodal payload shape, image/response size limits and output normalization. The live-server smoke starts NK1 with fake loopback model endpoints and verifies diagnostics plus classification, affect and embedding HTTP routes end to end. The suite is registered in the runtime package, WorkPass71 CI and a focused CI workflow.

**Do not treat this document or a configured endpoint as proof of model quality.** The suite still needs to execute successfully on the exact branch; actual device inference, latency/RAM measurements, retrieval uplift against an untouched holdout, and long-soak behavior remain separate validation gates.
