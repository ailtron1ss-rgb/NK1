# P2659–P2674 — GIANT Cross-Layer Grounding Upgrade

## Реализовано

- P2659: CrossLayerAdaptiveArbiter
- P2660: ExternalGroundingAdaptiveController
- P2661: integration into NeuralExperienceBranch
- P2662: source-specific reliability learning
- P2663: disagreement-sensitive rerouting
- P2664: risk/uncertainty-aware verification/defer path
- P2665: persistent arbiter state
- P2666: adaptive external sensor-channel reliability
- P2667: freshness/contradiction tracking
- P2668: active-perception request signal
- P2669: cross-layer diagnostics
- P2670: standalone benchmarks
- P2671: neural-branch integration benchmark
- P2672: persistence checks
- P2673: research record and ablation plan
- P2674: release integrity / version closure

## Главный архитектурный эффект

Существующие cognitive modules больше не объединяются только фиксированной ручной линейной суммой. Их вклад проходит через обучаемый arbiter, который учитывает reliability, confidence, disagreement, compute budget и risk.

Внешние сенсорные данные получают отдельный grounding quality layer, который может инициировать verify/explore при отсутствии свежего или согласованного свидетельства.
