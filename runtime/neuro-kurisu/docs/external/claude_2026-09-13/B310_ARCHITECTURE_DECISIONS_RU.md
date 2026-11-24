# B310 Architecture Decisions

1. `sourceCredit` belongs to B297 canonical executive fusion; it is not a new learner.
2. Silent sources do not enter the active fusion denominator, but remain persisted/diagnostic.
3. Source reliability is not updated when a source emitted no meaningful signal.
4. Utility uses a bounded monotonic transform to preserve ranking information below the old zero floor.
5. `decision.candidates` and workspace candidate surface use `governedCandidates`, preventing stale pre-arbitration records.
6. B297 state is persisted every cognitive pulse because source-credit/consolidation state is small and outcome-bearing.
7. Schema remains 127; migration is additive and backward-compatible.
8. B310 does not attempt to force whole-organism behavior by multiplying policy coefficients. Natural distribution shift remains an explicit benchmark target for B311.
