# B501-B560 — Giant Meta-Memory + World-Model Upgrade

## Цель
Перевести B500 от фиксированного набора мета-когнитивных эвристик к более цельному циклу:

`опыт → временная иерархия памяти → абстракция → выбор стратегии → вычислительный бюджет → прогноз/контрфактуал → действие → результат → калибровка уверенности → консолидация → развитие стратегии`

## Что внедрено

1. Hierarchical temporal memory: четыре уровня абстракции, локальная temporal continuity и bounded consolidation.
2. Complexity-aware recall: глубина поиска зависит от uncertainty/novelty/prediction error.
3. Meta-router: выбор одной из шести когнитивных стратегий.
4. Confidence calibration: отдельная оценка calibration bias и Brier-like error.
5. Lightweight counterfactual world check: сравнение ближайших transition traces по действию.
6. Transfer scoring: переносимость эпизода оценивается отдельно от similarity.
7. Experiment selection: information-gain pressure получает собственный signal.
8. Compute scheduler: режимы minimal/normal/deep/research реально меняют работу слоя.
9. Multi-lesion verification.
10. Restart persistence.
11. Исправлено ранее найденное: в full decision path теперь действительно учитываются B421 и B451 residual contributions; ранее они вычислялись, но не попадали в `rawUtility`.

## Что намеренно не заявляется

Этот слой не доказывает сознание или биологическое сходство с человеческим мозгом. Это экспериментальная cognitive architecture.
