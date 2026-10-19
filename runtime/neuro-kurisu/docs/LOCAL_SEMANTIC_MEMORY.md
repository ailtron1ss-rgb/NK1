# Local semantic memory retrieval (WorkPass33)

MemoryOS2 remains the only canonical memory store. This optional layer adds a bounded derived embedding index to the existing read-only Memory Inspector and retains BM25, fuzzy, entity, temporal and graph fallback behavior.

## Ollama (default)

1. Start Ollama locally and pull an embedding model, for example `ollama pull embeddinggemma`.
2. Start Neuro Kurisu as usual.
3. In Runtime Atlas → Memory Inspector, enter a query and enable **Семантический поиск (локальная модель)**.
4. The status line reports provider/model-index coverage. First use indexes a bounded group of memories; subsequent queries progressively warm the index.

Defaults: `NK_EMBEDDINGS_PROVIDER=ollama`, `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:11434`, `NK_EMBEDDINGS_MODEL=embeddinggemma`, request timeout 5 seconds, request batches of 24, text cap 2400 characters, and a maximum of 2048 cached vectors. Each retrieval backfills at most 96 canonical rows. The derived memory index is capped at 1600 rows and is rebuilt lazily after process restart.

## llama.cpp OpenAI-compatible API

Set `NK_EMBEDDINGS_PROVIDER=openai-compatible`, `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:8080/v1`, and `NK_EMBEDDINGS_MODEL` to the loaded embedding model alias. If authentication is configured, use `NK_EMBEDDINGS_API_KEY`.

## Safety and fallback

Endpoints are loopback-only by default, redirects are rejected, input size/batch size/time are bounded, and response vectors are validated and normalized. A remote host is rejected unless `NK_EMBEDDINGS_ALLOW_REMOTE=1` is explicitly set; remote endpoints must use HTTPS. No text is logged by the adapter. On timeout, malformed response, model-not-found, or unavailable service, inspector results come from the normal deterministic BM25/fuzzy/graph retrieval path and include a fallback reason. The HTTP adapter emits no requests unless semantic search is explicitly selected.

## Live cognitive retrieval (WorkPass34)

The Memory Inspector remains opt-in per query. To also let semantic results influence the ordinary cognitive cycle, set `NK_EMBEDDINGS_RUNTIME_ENABLED=1` after configuring a working local embedding endpoint. The runtime first runs canonical BM25/fuzzy retrieval, then attempts semantic reranking with at most 12 document embeddings and a 24-item lexical pool. The default foreground budget is `NK_EMBEDDINGS_RUNTIME_BUDGET_MS=220` milliseconds (accepted range 50–1000 ms); if inference is slower, the current turn immediately keeps the lexical result while one bounded background indexing request may finish warming the derived index. A second concurrent semantic job is not started until the first settles. `NK_EMBEDDINGS_TIMEOUT_MS` bounds the total provider batch time. Semantic model failures never block the turn or replace canonical memory with a derived index.
