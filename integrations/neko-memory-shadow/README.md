# NK1 × N.E.K.O. memory shadow adapter

Dependency-free, read-only adapter for evaluating N.E.K.O.-style hybrid retrieval against NK1's canonical MemoryOS2 channels.

MemoryOS2 remains the sole source of truth. This adapter accepts ranked IDs from existing NK1 retrievers; it does not embed text, fetch memory bodies, persist data, or change OrganismState. It enforces subject ownership before scoring and excludes unscoped candidates from scoped recall. Diagnostics contain IDs/ranks/scores only.

The RRF score is sum(weight / (rrfK + one-based rank)); default rrfK=60. Inputs are bounded by channel count, candidate count, output size, ID length and weight. No external dependencies or network access are required.

Run tests from this directory with npm test.

Keep this feature shadow-only until independent bilingual source-clustered holdout evaluation proves positive recallDelta over at least five paired seeds, with no subject leakage, material unsupported-retrieval increase or latency-budget regression.
