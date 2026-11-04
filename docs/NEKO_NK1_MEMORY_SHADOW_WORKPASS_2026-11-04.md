# N.E.K.O. → NK1: MemoryOS2 shadow integration (2026-11-04)

## Scope and current NK1 architecture

NK1 MemoryOS2 already implements a six-channel weighted RRF in its live retrieval path. Its current channel weights are BM25=1.0, token coverage=0.90, fuzzy=0.60, metadata=0.28 when enabled (otherwise 0), entity=0.42 and relationship=0.32, with k=60. The N.E.K.O. contribution is therefore not a replacement RRF engine; it is a read-only comparison path for alternate channel combinations and an optional cosine/vector channel.

MemoryOS2 remains the sole memory owner. No N.E.K.O. Python memory store, persistence schema, prompt assembly or embedding cache is imported.

## Runtime integration

- Added `MemoryOS2.previewRetrieveWithRankedChannels(...)`: it clones the canonical snapshot into an isolated instance and returns only baseline IDs, six channel-ranked ID lists, current weights and answerability diagnostics.
- Rank export occurs only after the same `direct-evidence-or-typed-recall-v1` answerability gate as canonical recall. Ungrounded candidates cannot be resurrected by shadow fusion.
- The isolated preview does not mutate canonical MemoryOS2 state. It does not return memory text.
- Added `previewNekoHybridMemoryRanking(...)`: it consumes that real preview and can explicitly request the existing semantic embedding preview as an additional vector channel.
- If the canonical path abstains, vector-only IDs are returned as `exploratorySemanticIds` for offline holdout evaluation only. They never enter `shadowIds`; `userFacingEligible` is always false.
- The evaluator can replay NK1's current weights (including zero-weight disabled channels) or compare equal-weight N.E.K.O.-style RRF. No user-facing recall path is changed.

## Mathematical contract

RRF(d) = sum over channels c of weight(c) / (k + rank(c,d)); ranks are one-based and default k=60.

- rank 1 in two channels: 2/61 = 0.0327868852459.
- ranks 1 and 2: 1/61 + 1/62 = 0.0325224748810.

Time complexity is O(C*N + U log U), where C is channel count, N is the per-channel candidate cap and U is unique IDs. The evaluator accepts at most 8 channels, at most 512 candidates per channel, and at most 64 output IDs. The MemoryOS2 export itself is bounded to 192 IDs per channel. Memory is O(U).

## Safety and promotion gates

- Accessor-backed records, Proxy objects, sparse arrays, malformed IDs and invalid weights fail closed.
- Equal-score ties use locale-independent code-unit ordering.
- Canonical abstention cannot be bypassed by a vector-only shadow result.
- The optional embedding preview is explicit; provider metadata is returned, memory text is not.
- The suite verifies rank math, scoping, zero-weight channels, maximum bounds, preview immutability, answerability preservation, optional vector behavior and text-free output.

Unit tests prove adapter mechanics only. They do not prove retrieval uplift. Next gates: immutable bilingual RU/EN source/session-clustered holdouts across at least five paired seeds; report Recall@K, MRR, nDCG, false-positive retrieval, subject leakage and latency; promote only if the established recallDelta > 0 gate is met with acceptable confidence bounds.
