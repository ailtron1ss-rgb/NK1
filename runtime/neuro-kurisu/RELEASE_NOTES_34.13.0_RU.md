# Neuro-Kurisu 34.13.0 — BIG PASS 44

## Cognitive Kernel decomposition
- добавлен `CognitiveKernelCoordinator` для P61/P64;
- OrganismCore использует единый integration boundary;
- добавлен kernel snapshot через facade.

## P30 batching
- добавлен семантически корректный `predictIndependentActions()`;
- candidate evaluation использует один batch pass вместо семикратной vectorization state;
- добавлен equivalence test.

## Mobile hot path
- P24 body forecast вычисляется один раз на tick;
- сохранены предыдущие caches/adaptive cadence;
- sequential rollout не был ошибочно распараллелен.

## Verification
- 250-cycle benchmark PASS: warmedMedianRatio=1.792;
- 500-cycle natural остаётся OPEN из-за verification timeout;
- полный composite release audit остаётся OPEN из-за длинного исторического suite.
