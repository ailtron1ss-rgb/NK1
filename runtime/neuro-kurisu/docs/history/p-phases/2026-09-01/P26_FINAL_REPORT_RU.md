# P26 — Финальный отчёт

## Результат

P26 переводит проект от преимущественно bucket/table adaptation к настоящему параметрическому обучению в ограниченном и проверяемом пространстве состояний и действий.

### Добавлено

- `ParametricPolicyLearner` — непрерывная функция ценности, обучаемая нормализованным SGD.
- `P26TrueLearningEngine` — online TD-learning, replay, holdout metrics, freeze/unfreeze и persisted parameters.
- `ContextualWorldModel` — обучаемый контекстный reward predictor и bounded forecast следующего состояния.
- `/api/organism/true-learning` и replay endpoint.
- Schema migration 28 → 29.
- P26 unit, world and migration tests.
- документация truthfulness/evidence для границ заявлений.

## Доказательство обучения

Контролируемый P26 holdout test:

`pre-learning`: агент не различает целевые состояния.

`post-learning`: accuracy на отложенной выборке = `1.000`.

Это доказывает рабочее параметрическое обобщение в тестовом feature space. Это не доказывает general intelligence или end-to-end learning из сырого мультимодального сигнала.

Контекстный world test:

`pre = 0.500`

`low-resource learned = 0.828`

`high-resource learned = 0.126`

Модель научилась контекстно различать ожидаемый reward для одного действия.

## Структура

- canonical runtime: `src/organism`
- legacy snapshot: `legacy-original`
- source files: 195
- canonical files: 105
- active audited files: 272
- legacy snapshot entries: 1413
- archive manifest entries: 1702

## Версии

- Application: `7.6.0`
- Organism Core: `23.0.0-p26-neural-perception-true-learning`
- State Schema: `29`
- Node: `>=22.12.0`
- npm: `>=10.8.0`

## Ограничения

1. Reward signal задаётся runtime/external outcome path.
2. Feature space задан архитектурно, а не изучается из raw sensory stream.
3. Action space фиксирован.
4. ContextualWorldModel пока не является полноценной latent dynamics model.
5. Semantic vision/audio по-прежнему не заявляются без реального backend output.
6. Реальный POCO endurance gate не может быть признан выполненным внутри Linux build environment.

## Итог

P26 устраняет исходную проблему «организм только запоминает bucket-контексты».

Следующий главный барьер — learned representations и реальное автономное научное развитие на новых задачах.
