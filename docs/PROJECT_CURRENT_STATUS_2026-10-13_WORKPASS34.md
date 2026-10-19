# Neuro-Kurisu — current implementation status — WorkPass 34

**Date:** 2026-10-13  
**Canonical runtime:** Neuro-Kurisu 35.57.0 / state schema 224  
**Release status:** implementation workpass; not release-ready.

## WorkPass34 code outcome

Added an optional local semantic-embedding path to the existing canonical MemoryOS2 retrieval and Runtime Atlas Memory Inspector. The new adapter supports Ollama embeddings and llama.cpp's OpenAI-compatible embeddings endpoint; validates and normalizes vectors; bounds request size, batch size, timeout and cache; rejects redirects; restricts endpoints to loopback by default and requires explicit opt-in plus HTTPS for remote use. The MemoryOS2 layer uses a capped derived vector index and progressively indexes at most 96 rows per query. Results fuse embedding similarity with existing lexical rank, query coverage, entities, temporal hint and salience. Provider errors return existing BM25/fuzzy/graph results, and the inspector remains read-only.

## Current roadmap inventory

- DONE: 61
- PARTIAL: 11
- TODO: 10
- Weighted release-readiness score: 72.9% (unchanged; no uplift claimed).

## Still open

Live Ollama/llama.cpp model inference depends on a locally installed model and was not claimed as executed in this environment. No independent labelled temporal holdout uplift is claimed. The broader app production build, interactive browser/Live2D E2E, clean-room restore/rollback, soak and final release sign-off also remain open.


## WorkPass34 — live cognitive semantic retrieval

The optional local embedding provider now connects to the ordinary OrganismCore observe cycle through MemoryFabric. It uses a 220 ms foreground budget by default, caps each background index-warming batch at 12 memory rows, allows one in-flight job per MemoryFabric, and preserves BM25/fuzzy results when the provider is slow or unavailable. Enable with `NK_EMBEDDINGS_RUNTIME_ENABLED=1`; live local model quality is not claimed without a target-device inference run and independent temporal holdout.
