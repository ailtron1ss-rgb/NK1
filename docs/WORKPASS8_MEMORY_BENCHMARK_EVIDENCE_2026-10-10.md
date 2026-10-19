# Neuro-Kurisu SUPER — WorkPass 8: Memory Benchmark Evidence Integrity

**Date:** 2026-10-10  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS7_2026-10-09.zip`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Scope:** targeted implementation on the existing MemoryOS2 retrieval benchmark path; no replacement tree or new memory owner.

## Implemented

1. Extended `MemoryRetrievalBenchmark` with a strict dataset-integrity gate. Normalized prompts duplicated within or across `train`/`holdout`, duplicate example IDs, duplicate labels, unknown relevant memory IDs, malformed rows, and silent input truncation are surfaced and prevent candidate eligibility.
2. Added explicit dataset provenance fields (`datasetId`, `datasetVersion`, `sourceRef`, `labelingProtocol`). Missing provenance prevents eligibility even when metric deltas look favorable.
3. Made dataset and corpus fingerprints independent of caller row ordering. Examples are normalized and sorted before evaluation; corpus rows are sorted before hashing.
4. Added deterministic paired bootstrap percentile intervals for per-query recall@k and MRR. The seed and number of samples are returned in the report; timing remains separated into retrieval latency and isolated-clone setup latency.
5. Exposed bounded `bootstrapSamples`, `seed`, and provenance fields through the existing `POST /api/organism/memory-benchmark` handler. The handler no longer silently filters malformed rows before validation; excess row counts are passed to the validator and block eligibility. It remains a read-only report endpoint and never promotes a candidate or mutates live memory, policy, or identity.
6. Extended the retrieval benchmark regression and real HTTP server smoke to check row-order reproducibility, split leakage, unknown ground-truth IDs, missing provenance, and endpoint forwarding of the deterministic seed.

## Targeted verification

- `npm run audit:workpass8` in `runtime/neuro-kurisu` — PASS. This includes the benchmark regression, runtime TypeScript typecheck, server-relative-import audit (10 checked, 0 missing), UI/API linkage audit (124 client routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing), and HTTP server smoke.
- HTTP smoke includes propagation of provenance/seed and detection of malformed rows plus unknown ground-truth IDs.

## Evidence boundary

The regression fixture is synthetic (18 memory records, 4 train rows, 8 unique holdout queries), solely to test the harness. A small-fixture example delta of +0.125 recall@k is **not** evidence of production MemoryOS2 uplift. The paired interval is reported, not treated as production scientific validation. A real labeled corpus with immutable provenance, independently authored labels and a pre-registered multi-seed holdout protocol is still required. Dataset provenance in an API request is caller-supplied metadata and must be checked against the real corpus artifact in the eventual evaluation pipeline.

## Release status unchanged

This workpass does not claim release readiness. Full React/Vite build, browser/mobile/Live2D E2E, real-corpus Memory 2.0 benchmark, clean-room restore/upgrade/rollback, multi-hour soak, and final SBOM/provenance gates remain open. Historical task counts and the WorkPass 7 scorecard are not silently recalculated.
