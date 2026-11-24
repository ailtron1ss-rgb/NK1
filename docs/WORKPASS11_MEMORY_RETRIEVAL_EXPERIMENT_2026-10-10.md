# Neuro-Kurisu SUPER — WorkPass 11: MemoryOS2 retrieval quality and experiment reproducibility

**Date:** 2026-10-10  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS10_2026-10-10.zip`  
**Base SHA-256:** `3345b5d9d773476f91069848a37cf2355c09a53e844702fbef587df9620fc1df`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Scope:** MemoryOS2 retrieval determinism, corpus integrity, and an offline experiment path; no new memory owner and no production-memory mutation.

## Implemented

1. **Deterministic candidate selection in `MemoryOS2.retrieve`.** The prior candidate cap used the first 192 matching IDs yielded by internal token-index Sets, meaning row/index order could change which memories were even scored. Candidate support is now accumulated across unique query tokens by inverse-document-frequency, the strongest 192 candidates are selected with stable memory-ID tie-breaks, the recent-memory fallback uses explicit timestamps plus ID, revision groups have explicit stable ordering, and semantic/BM25/final score ties use memory ID. Runtime diagnostics report the policy as `idf-priority-stable-id` and the cap `192`.
2. **Complete corpus fingerprint.** The prior fingerprint hashed only a few memory fields. It now canonicalizes object-key order and fingerprints complete sorted memory rows, including scoring weights, vectors, entities, tags/context, links, revision lineage, temporal validity, epistemic state and provenance. Snapshot row ordering does not change the hash.
3. **Separate ranking-configuration fingerprint.** A distinct SHA-256 captures the adaptive retrieval policy and top-level counters/version that influence policy selection. Two runs cannot claim the same complete input identity solely because their memory rows match while their retrieval-policy state differs.
4. **Corpus integrity gate.** Malformed rows, duplicate memory IDs and truncation beyond the supported canonical corpus bound are counted explicitly. Ambiguous corpus inputs block candidate eligibility with `corpus-integrity-failed`.
5. **Additional retrieval-safety outcomes.** Benchmark metrics count future-valid, dormant and unsupported epistemic-status results. A candidate returning such rows cannot become eligible for separate review.
6. **Bounded offline benchmark runner.** `scripts/run-memory-retrieval-experiment.mjs` accepts a read-only `MemoryOSState2` snapshot, independently labelled JSONL query set and dataset-provenance JSON. It supports up to 512 examples and 3–9 distinct bootstrap seeds. Input sizes are bounded; malformed labels fail closed; the report output is exclusive-create and will not silently overwrite an existing report.
7. **Bootstrap seed sensitivity and determinism evidence.** `MemoryRetrievalExperiment.ts` runs the fixed baseline/candidate evaluation over several bootstrap seeds, checks stable quality metrics and fingerprints, summarizes confidence-bound sensitivity, and only ever returns `allowed: false`. These seeds vary resampling, not model training; passing the experiment is not automatic promotion.
8. **Documentation and repeatable scripts.** Added an experiment protocol, README instructions, benchmark/experiment tests, `test:memory-retrieval-experiment` and `audit:workpass11`, with changelog, source-version and append-only task-list updates.

## Verification run

- `tests/big-pass-126-memory-retrieval-benchmark.mjs` — PASS, including ranking-field fingerprint changes, policy fingerprint changes, malformed/duplicate corpus gates and 65-row limit behavior.
- `tests/memory-retrieval-experiment.mjs` — PASS, including real CLI invocation with temp snapshot/JSONL/provenance files, non-overwrite behavior, no snapshot mutation, stable metrics across seeds, and 260-row candidate-selection permutation regression.
- Runtime TypeScript typecheck (`tsc`) — PASS.
- Server relative imports — 10 checked, 0 missing.
- UI/API linkage — 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing.
- Canonical organism server smoke — PASS.
- Asset audit — PASS, 0 errors across configured Live2D and sprite references.

The added row-order regression uses a 260-item synthetic corpus specifically to cross the 192-candidate cutoff. It demonstrates determinism, not retrieval-quality improvement on production data.

## Actual boundaries / open work

- No real independently labelled user/project corpus was included with WorkPass 10. This pass delivers the import/evaluation workflow but does not claim production recall/MRR uplift.
- Bootstrap seeds measure interval sensitivity on a fixed deterministic retrieval, not model-training randomness. Stronger production evidence requires independently collected, fixed holdouts or temporal holdout partitions and a declared labeling/adjudication protocol.
- The HTTP diagnostic endpoint retains its bounded 64-example request path; use the offline runner for larger corpora.
- Full React/Vite production build, desktop/mobile/Live2D browser E2E, clean-room restore/upgrade/rollback, multi-hour resource soak, external-provider postcondition/reconnect tests, and final SBOM/provenance remain open release gates.

## Change boundaries

`MemoryOS2` remains the only canonical runtime memory owner. The new experiment module is offline and read-only. The CLI restores snapshots into isolated clones and never writes to live memory/policy/identity. Research benchmark outputs remain review-only.
