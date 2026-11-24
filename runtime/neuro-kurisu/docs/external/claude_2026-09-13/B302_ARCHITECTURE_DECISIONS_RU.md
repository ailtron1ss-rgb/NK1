# B302 Architecture Decisions

## Decision 1 — coordinator, not another learner
B302 does not learn a second representation. B296/B299/B285 remain the canonical learning paths.

## Decision 2 — bounded ledger
Long-horizon history is intentionally bounded. Detailed history belongs to existing memory/consolidation layers, not the B302 evidence ledger.

## Decision 3 — separate cognition benchmark from persistence benchmark
Long-horizon cognition uses sparse checkpointing. B301 separately validates forced checkpoint + restart.

## Decision 4 — verify real world transition
The long-horizon test includes real `worldTransition` feedback so B302 evidence is connected to the existing causal bridge.

## Decision 5 — no consciousness claim
Metrics are engineering evidence and should never be presented as a direct measurement of subjective experience.
