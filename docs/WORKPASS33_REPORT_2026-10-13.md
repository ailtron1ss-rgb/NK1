# WorkPass33 — local semantic retrieval integrated into MemoryOS2 — 2026-10-13

## Implemented

- Added `LocalEmbeddingProvider` with Ollama `/api/embed` and OpenAI-compatible `/v1/embeddings` adapters (supports llama.cpp).
- Added bounded request batching, text truncation, model-keyed LRU vector cache, vector dimension validation and L2 normalization.
- Restricted endpoints to loopback by default; remote endpoints require explicit opt-in and HTTPS. Requests reject redirects, use a bounded timeout and do not log query text.
- Added asynchronous, read-only `MemoryOS2.previewRetrieveWithEmbeddings`. It incrementally backfills up to 96 missing memory vectors per query and caps the derived index at 1600 rows.
- Semantic ranking fuses embedding cosine similarity with canonical lexical rank, term coverage, entity overlap, temporal hints and salience. If the provider is absent or fails, the existing canonical BM25/fuzzy/graph retrieval result is returned with a visible fallback reason.
- Connected the feature through `MemoryFabric`, `OrganismCore`, `/api/organism/memory-inspector?semantic=1`, and a Runtime Atlas checkbox. The existing ordinary search and temporal inspector routes remain unchanged.
- Added setup instructions for Ollama and llama.cpp, a fixture-backed semantic retrieval regression and provider-contract tests.
- Updated project/runtime versions to 33.0.0-super-final19 / 35.56.0 and aligned the runtime lockfile.

## Acceptance performed

- `npm run audit:workpass33` in `runtime/neuro-kurisu`: PASS.
- Runtime TypeScript: PASS.
- Provider batch/caching/security contracts: PASS.
- Conceptual semantic ranking and read-only snapshot behaviour using a deterministic fixture provider: PASS.
- Provider failure returns deterministic lexical/fuzzy fallback: PASS.
- WorkPass32 fuzzy retrieval regressions: PASS.
- Numeric retrieval / temporal exclusion: PASS.
- WorkPass31 canonical lifecycle replay: PASS.
- HTTP server smoke: PASS.

The fixture test proves the ranking path and endpoint adapter contract; it does not prove live model execution. This environment did not run a real Ollama or llama.cpp model, and no independent labelled temporal retrieval improvement is claimed. Full root release gates are recorded separately.
