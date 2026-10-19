# R14 — Memory transfer and adaptive retrieval

R14 continues the direct adaptation of `memo-0.3.0` into the canonical `MemoryOS2` owner.
No second memory database or independent memory runtime was introduced.

## Directly adapted

- content-addressed identity, canonicalization, exact/semantic reconciliation;
- runtime context capture without a Git subprocess on the cognitive hot path;
- batch reconciliation and compatibility projection;
- hybrid retrieval: dense semantic + BM25 + entity overlap + temporal/causal signals;
- Reciprocal Rank Fusion (RRF)-inspired rank blending for semantic/BM25 evidence;
- identifier-aware lexical bias for exact project/action/document identifiers;
- bounded one-hop traversal over existing semantic/causal links as a native graph-memory adaptation;
- lightweight contradiction links for high-similarity records with shared entities and opposite negation polarity;
- lazy vector materialization for cold memories selected as retrieval candidates;
- corrected index accounting during capacity eviction/maintenance;
- public snapshot synchronization of live neural experience state before persistence projection.

## External research used

Mem0's current retrieval documentation describes semantic, BM25, and entity matching as parallel signals that are normalized/fused for ranking, while its graph-memory design derives links from shared entities. Microsoft GraphRAG similarly treats entities/relationships as retrieval structure rather than requiring a separate runtime for every application. These ideas were adapted to the project's existing arrays/maps and bounded mobile execution instead of adding a graph database.

See: https://github.com/mem0ai/mem0/blob/main/docs/platform/features/graph-memory.mdx
See: https://github.com/mem0ai/mem0/blob/main/docs/migration/oss-v2-to-v3.mdx
See: https://microsoft.github.io/graphrag/index/methods/

## Intentionally not imported

No external BM25 package, graph database, cross-encoder, or second embedding store was added. Cross-encoders were excluded from the mobile hot path because the extra latency is disproportionate to the current bounded-memory regime.

## Verification

- typecheck: PASS
- R5 memory authority regression: PASS
- R13 Memo memory integration: PASS
- R14 hybrid-memory integration: PASS
- P2854 core restart: PASS
- P2855 contextual policy: PASS
- P2855 organism integration: PASS
- P290 reality/world hotpath: PASS
- R12 upstream replay: PASS
- R12 P30 reservoir: PASS
- R12 neuromodulation: PASS
- mobile 256 MB benchmark: PASS (30 cycles)

## Transfer progress

The Memo transfer is now estimated at **~82% of the selected useful surface**:
identity/dedup/reconcile/persistence adaptation are complete; hybrid retrieval, graph-aware recall, contradiction linking and decay-oriented lifecycle are substantially integrated. MCP surface and human-readable vault projection remain intentionally separate and are not required for the canonical organism memory owner.

This percentage measures integration of selected useful mechanisms, not project completion and not consciousness.
