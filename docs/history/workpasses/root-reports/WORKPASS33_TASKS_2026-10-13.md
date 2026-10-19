# WorkPass33 — implementation tasks — 2026-10-13

## Completed in this pass

- [x] Implement local embedding adapter for Ollama and OpenAI-compatible llama.cpp endpoints.
- [x] Bound time, batch size, input length, vector dimension, cache size and index size.
- [x] Require loopback endpoints by default; require explicit remote opt-in plus HTTPS for remote hosts; reject redirects.
- [x] Add progressive bounded vector indexing and semantic reranking in canonical MemoryOS2.
- [x] Keep semantic retrieval read-only and preserve lexical/fuzzy/graph fallback on provider failure.
- [x] Connect MemoryFabric → OrganismCore → inspector API → Runtime Atlas toggle.
- [x] Add provider fixture/contract tests and usage documentation.
- [x] Align root/runtime version metadata and lockfile for WorkPass33.

## Next implementation work (not checks-only passes)

1. Install/run a real local embedding model on the target machine, index a realistic corpus, and tune batch/timeout defaults from actual latency/RAM results.
2. Make semantic query/document vectors survive restart in a version-bound derived cache without bloating canonical memory payloads; invalidate precisely on revision/model change.
3. Thread async semantic retrieval into selected production context builders, with deadline-aware fallback so core cognition never blocks on a model server.
4. Improve retrieval quality using a fixed independent multilingual temporal holdout; keep promotion closed until semantic mode materially beats BM25/fuzzy without worsening freshness/conflict handling.
5. Continue the existing roadmap: dependency-complete UI build, browser/Live2D E2E, clean-room restore/rollback and release durability.

Live local inference and retrieval-quality uplift are not marked done in this task list.

## Final acceptance status

- [x] Full root `npm run audit:workpass33` completed with exit code 0.
- [ ] Live local-model inference on the target machine (not run in this build environment).
- [ ] Independent retrieval-quality uplift over BM25/fuzzy (promotion intentionally remains closed).
