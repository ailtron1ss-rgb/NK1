# B421–B450 — Research Acceleration Fabric

## Цель
Связать причинную память, процедурное обучение, adaptive routing, adaptive compute, иерархическое предсказание мира, coordinated micro-rollouts, calibration и self-experiment в один bounded developmental слой над canonical B365/B299 decision spine.

## Реализовано
- B421 Causal/typed retrieval: context-gated episodic + causal edge retrieval.
- B422 Procedural refinement: utility/confidence/failure tracking и компактная процедурная память.
- B423 Meta-routing: динамический выбор когнитивной стратегии по неопределённости, новизне, prediction error и накопленной ошибке экспертов.
- B424 Adaptive compute: minimal/normal/deep/research modes.
- B425 Hierarchical world model: 1/2/3-step lightweight predictions.
- B426 Coordinated micro-rollouts: несколько горизонтов и bounded aggregation.
- B427 Confidence calibration: buckets, correctness tracking, uncertainty-aware confidence.
- B428 Self-experiment proposals: expected-information-gain signal для выбора ситуаций, где выгоднее исследовать.
- B429 Lesion/ablation interface.
- B430–B450 integration/persistence/verification/docs.

## Архитектурное правило
Слой не является вторым canonical policy owner. Его влияние — bounded residual поверх B365/B299 governance path.

## Эксперимент
В контролируемом синтетическом associative-memory benchmark после teacher-forced verified training:
- baseline = 14.29%;
- B421–B450 adaptive research = 100%;
- прирост = +85.71 процентного пункта.

Это benchmark конкретного класса задач, а не оценка общего интеллекта; поэтому результат нельзя переносить на реальный мир без дополнительных тестов.

## Организм
Реальная интеграционная проверка OrganismCore: 17 decisions, 10 verified updates/episodes, 2 procedures, 2 causal edges, restart persistence PASS, aggregate lesion ≈ 0.01568.
