# B303 Architecture Decisions

1. B303 не владеет personality state.
2. B303 не модифицирует reward.
3. B303 не обучает policy.
4. B303 только измеряет training → holdout → recovery.
5. Context fingerprints bounded to fixed-size histories.
6. B303 persistence deferred to checkpoints/verified outcomes to avoid per-cycle clone overhead.
7. Full snapshot always synchronizes current B303 state.
8. Negative policy bias is persisted in signed range [-1, 1].
9. B303 integrates with B296/B299/B302 rather than replacing them.
