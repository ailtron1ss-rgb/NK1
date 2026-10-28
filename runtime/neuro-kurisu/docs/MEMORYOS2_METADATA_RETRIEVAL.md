# NK1 MemoryOS2 metadata-aware recall

## Scope

This change adds a separate low-priority inverted index over curated memory metadata (`tags`, `entities`, and allowlisted topic/context fields). It is intended to improve discovery when the query matches how a memory is classified but does not repeat words from the memory content.

Content-only BM25 term frequency and document frequency remain unchanged. Metadata tokens are held in separate postings, nominate additional candidates, and contribute a small independent ranking signal plus a low-weight reciprocal-rank-fusion channel. Query tokens are materialized once, and per-candidate metadata coverage is scored directly from those inverted postings rather than re-tokenizing each candidate's tags/context. Metadata does not overwrite the stored memory text, modify confidence, or promote a memory to a stronger epistemic status.

## Integrity and lifecycle

- Metadata values are length/count bounded; each source lane is capped at 64 unique tokens and each memory at 128 metadata tokens, selected by round-robin across tags, entities and allowlisted context fields. Allowlisted fields are filtered before the field cap, so unrelated context keys cannot starve topic metadata; arbitrary JSON context is not recursively mined.
- Index addition and deletion update metadata postings with the canonical MemoryOS2 item lifecycle. Deduplication/reconsolidation and the explicit `updateContext()` API both capture pre-mutation metadata tokens and update only changed postings, including removal of tokens from a replaced topic; they do not scan the entire vocabulary.
- `indexDiagnostics()` reconstructs expected metadata postings from canonical items and includes `metadataIndexMismatch` in its `pass` decision.
- The regression uses 132 unrelated distractors so targeted memories fall outside the 128-record recent fallback; it checks metadata-only topic/entity recall, noisy-context budget fairness, direct-content priority, dedup-merge and `updateContext()` posting refresh/removal, index diagnostics, restore without stale IDs, and canonical deletion cleanup.

## Validation and promotion boundary

Run from `runtime/neuro-kurisu`:

~~~bash
npm run test:memoryos2-metadata-retrieval
npm run test:memory-retrieval-experiment
npm run typecheck
~~~

This is a retrieval candidate-quality improvement, not proof of recall uplift. The existing labelled retrieval experiment and independent holdout/promotion gate remain authoritative. Do not modify labels or holdout data in response to candidate results; `promotion: not-promoted` must remain until an independent immutable holdout shows the required uplift and safety/non-inferiority metrics.

The integration CI runs the new metadata regression alongside Hexis, Mem0, GEPA, native P23, retrieval provenance and HTTP smoke contracts.