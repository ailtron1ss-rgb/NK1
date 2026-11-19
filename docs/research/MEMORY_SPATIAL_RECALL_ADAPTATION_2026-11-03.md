# NK1 spatial memory — bounded native adaptation

## Design

This work adds frame-aware spatial recall to the existing canonical MemoryOS2 store. It does not add SQLite, Chroma, FAISS, a second memory owner, or a required runtime dependency.

Canonical coordinates remain in MemoryItem2.context using:
- spatialFrameId: non-empty coordinate-frame identifier (up to 64 characters)
- spatialX, spatialY, optional spatialZ: finite numeric strings in the range ±1,000,000

A query supplies { frameId, x, y, z?, radius } through the existing retrieval options. Frames are isolated; the index never compares coordinates from different frames. Radius is bounded to 24 units. Invalid query shapes fail closed for the spatial channel.

## Index

The derived in-memory index uses a 4-unit uniform 3D grid. It stores only ID-to-cell and cell-to-ID postings; canonical point values remain in MemoryOS2 records. Each query inspects at most 4,096 cells and returns at most 128 distance-ranked hits. The source corpus is already bounded by MemoryOS2's 1,600-item capacity.

Writes, context updates, forget/eviction and snapshot restore update or rebuild the index. indexDiagnostics() checks the derived index against canonical context data.

## Retrieval

Spatial hits share the existing 192-candidate ceiling with BM25/fuzzy/metadata/graph retrieval. Spatial queries reserve at most 64 candidates from the lexical budget; a bounded proximity score contributes to ranking. The ordinary answerability gate remains intact for text-only queries, while an explicit valid spatial query can itself provide typed spatial evidence.

## Research adaptation

eMEM (Rasheed & Kabtoul, 2026, arXiv:2606.03374) motivates hybrid retrieval over semantic, temporal and spatial axes and diagnostic memory benchmarks. Pezzulo et al. (2026, arXiv:2607.13560) summarize hippocampal-entorhinal maps, conceptual navigation, affordances and active perception. NK1 adopts only the computational abstraction: explicit frames, bounded metric proximity and a rebuildable index. A uniform grid is chosen over an R-tree because NK1's memory cap is 1,600 records and typical queries are bounded-radius lookups; this choice must be benchmarked before raising the scale target.

These papers motivate hypotheses. They do not demonstrate machine consciousness or establish direct neural equivalence.

## Gates not yet satisfied

This PR adds an implementation and deterministic regressions. It does not claim a recall improvement. Next gates are paired spatial-vs-baseline probes, multi-seed retrieval quality and latency tests, coordinate provenance/unit validation at perception adapters, and an end-to-end avatar/world-model call path.
