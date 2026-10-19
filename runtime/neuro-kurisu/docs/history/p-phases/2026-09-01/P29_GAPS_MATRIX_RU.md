# Что ещё не хватает после P29

## I. Уже работает, но требует внешней проверки

- Реальная 24/72/168-часовая работа на POCO.
- Catastrophic forgetting на длинной последовательности задач.
- Стабильность learned arbitration при нескольких месяцах эксплуатации.
- Реальная стоимость P26/P27/P28 на конкретном Android-устройстве.

## II. Есть как scaffold, но не как полноценная способность

- Semantic vision.
- Semantic audio.
- Multi-step learned world model.
- Real counterfactual environment.
- Persistent rollback across process restarts.
- Autonomous experiment generation.
- Long-term identity provenance graph.

## III. Архитектурные долги

- OrganismCore всё ещё слишком большой.
- Часть heuristic bias-ов не проходит через P29 arbitration.
- Нужно разделить hot-path и slow-path cognition.
- Нужно свести все resource budgets к единой экономике.
- Нужно унифицировать provenance между learning, memory, identity и values.

## IV. Научные долги

- Независимый blind evaluator.
- Pre-registered benchmarks.
- Holdout trajectory prediction.
- Statistical confidence intervals.
- Multi-seed reproducibility.
- Longitudinal ablation campaigns.
- Comparison against simpler baselines.

## V. Долговременное обучение

Главный следующий критерий: организм должен уметь улучшать одну задачу, изучать следующую и при этом не разрушать ранее выученную компетенцию.
