# N.E.K.O. → NK1: MemoryOS2 shadow integration (2026-11-04)

## Scope and ownership

Adapt N.E.K.O.'s hybrid ranking idea without importing its Python memory owner, persistence schema, prompt assembly or embedding cache. NK1 MemoryOS2 remains authoritative. The adapter is a candidate-only shadow primitive and is not wired into user-facing recall or the live OrganismCore cycle.

## Implementation

- Added a dependency-free ES module that combines existing ranked MemoryOS2 channel IDs.
- Added weighted Reciprocal Rank Fusion (RRF), deterministic tie-breaking and a privacy-reduced rank-list overlap comparator.
- Applies subject scoping before rank contribution; missing ownership metadata is excluded during scoped recall.
- Bounds channel count, candidates per channel, output count, identifier length, RRF k and channel weight.
- Rejects malformed records, inherited-prototype records, accessor-backed records, proxies, sparse arrays, duplicate channel names and invalid IDs.
- Equal-score ordering uses locale-independent UTF-16 code-unit ordering.
- Emits no memory text and performs no persistence or model inference.

## Mathematical contract

RRF(d) = sum over channels c of weight(c) / (k + rank(c,d)); ranks are one-based and default k=60.

- rank 1 in two channels: 2/61 = 0.0327868852459.
- ranks 1 and 2: 1/61 + 1/62 = 0.0325224748810.

Time complexity is O(C*N + U log U), where C is channel count, N is the per-channel candidate cap and U is unique IDs. Default limits cap raw references at 8*64=512 before sorting; memory is O(U).

## Verification and promotion boundary

The adapter's isolated Node suite checks rank math, subject filtering, duplicates, bounds, malformed/accessor/proxy/sparse inputs, locale-independent tie-breaking and overlap metrics. A passing unit suite proves deterministic mechanics only; it does not prove NK1 retrieval uplift. Next gates: map canonical NK1 ranked IDs, run immutable bilingual RU/EN source/session-clustered holdouts across at least five paired seeds, report Recall@K/MRR/nDCG/false-positive retrieval/subject leakage/latency, and promote only if the established recallDelta > 0 gate is met with acceptable confidence bounds.
