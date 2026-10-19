# P2687 — ГИГАНТСКИЙ ПРИХОД: Adaptive Replay + Multi-timescale Memory + Runtime Efficiency

Дата: 19.09.2026
Версия: 35.6.87
Release: P2687

## 1. Цель прохода

Цель оставалась исходной: развивать Neuro-Kurisu как непрерывный, автономный, когнитивный искусственный организм с устойчивой памятью, идентичностью, обучением, world/causal loop и проверяемым поведением. P2687 намеренно не добавляет декоративный модуль. Он усиливает реальную связь `experience graph → replay policy → learning signal → persistence → restart`.

## 2. Реальная работа с кодом

Относительно P2686 изменено/добавлено 20 файлов: 8 source/package/release source files, 6 test files, 3 research files и связанные release metadata. Грубая line-diff оценка: +676 / -52, net +624 lines. Около **85% работы прохода пришлось на код, тесты и интеграцию**, остальное — research/docs/gates.

### Реализовано

1. `AdaptiveReplayGovernor` с fast/medium/slow lanes.
2. Exponential forgetting-curve pressure и lane-specific half-life.
3. Surprise/novelty/transfer/identity/goal/stability selection.
4. Cooldown, interference guard и cluster redundancy guard.
5. Mobile budget cap.
6. Verified feedback → bounded adaptation policy weights.
7. Contextual effective weights для surprise/memory-pressure/energy/pressure regimes.
8. Identity/stability weight floors.
9. Пersistent governor state + restart restore.
10. Experience Continuum v7 integration.
11. Replay events теперь несут реальный scheduler tick.
12. Migration 194→195 исправлена и покрыта отдельным тестом.
13. Внутренний checkpoint hot-path больше не делает дополнительный deep-clone Experience Continuum: `snapshot({clone:false})`; clone сохраняется для публичных/безопасных API.
14. Добавлен controlled policy ablation.
15. Добавлен snapshot microbenchmark.
16. Исследовательские данные сохраняются под `research/2026-09-19/`.

## 3. Что нашли и исправили

### Реальный дефект migration
P2687 обнаружил, что миграционный слой ещё выставлял Experience Continuum version=6, хотя runtime уже v7. Это исправлено; state adaptiveReplayGovernor теперь переносится с v194→v195.

### Реальный дефект replay provenance
Consolidation-generated replay events писали `tick=0`. Это разрушало часть временной трассировки. Теперь event получает фактический tick scheduler-а.

### Неденетерминированный cooldown
Scoring использовал системный `Date.now()` вместо времени текущего replay-plan. Это заменено на переданный `at`, благодаря чему тесты и replay policy стали детерминированнее.

### Redundancy guard
Повтор одного и того же cluster теперь действительно снижает шанс повторного выбора, если нет достаточно сильного learning opportunity.

## 4. Производительность

Контрольный benchmark на 320 experience nodes и 40 iterations:

- deep-clone snapshot: 2.76199 ms/call
- shared-state snapshot: 0.006925 ms/call
- локальное снижение стоимости clone-операции: **≈99.75%**

Это не означает +99.75% к FPS/runtime всего организма. Это именно benchmark одной дорогой операции и используется как доказательство того, что hot-path optimization реальна.

## 5. Replay policy experiment

Одинаковый synthetic holdout: 96 кандидатов × 320 controller ticks.

| Политика | Quality proxy | Interference | Selected | Unique |
|---|---:|---:|---:|---:|
| Balanced | 0.79546 | 0.33512 | 342 | 6 |
| Surprise-heavy | **0.79713** | **0.30286** | 342 | 6 |
| Forgetting-heavy | 0.78095 | 0.32357 | 342 | 7 |
| Adaptive | 0.79513 | 0.32852 | 342 | **8** |

Это не retention benchmark. Самый важный вывод: **adaptive P2687 пока не доказал превосходство над surprise-heavy** на этом proxy. Поэтому проект не будет заявлять улучшение обучения без independent behavioural holdout. Adaptive policy при этом лучше распределяет выбор по уникальным memories и реально меняет policy по 241 verified-feedback update.

## 6. Research impact

В P2687 были перенесены в инженерно-безопасном виде идеи: surprise-driven memory, nested/multi-frequency memory updates, forgetting-curve scheduling, harm-aware replay и bounded memory-policy adaptation. Не переносились тяжёлые foundation backbones и unconstrained self-modification.

Новые 2026 результаты отдельно сохранены в research archive, включая replay harm, signal/order-aware replay и long-horizon continual-agent evaluation.

## 7. Что по проекту реально сейчас

- runtime architecture: **87/100**
- cognitive integration: **77/100**
- memory architecture: **82/100**
- identity/personality substrate: **70/100**
- function reality verification: **36/100**
- continuous cognition: **78/100**
- mobile readiness: **57/100**
- maintainability: **47/100**
- proven end-to-end functionality: **33/100**
- общий путь к целевой искусственной личности: **≈33/100**

Это инженерные оценки зрелости, а не научные оценки сознания.

## 8. Что остаётся слабым

1. Short autonomous restart smoke на 8 циклах подтверждает persistence adaptive scheduler, но не провоцирует реальный replay event; нужен longer controlled world/memory scenario.
2. Mobile RSS остаётся высоким. P2687 не выдаёт ложного обещания, что один clone optimization решил memory pressure.
3. Adaptive replay пока не победил surprise-heavy на proxy holdout.
4. Semantic behavioural coverage всё ещё значительно ниже static reachability.
5. Полноценное gradient test-time training, heavy Titans/JEPA backbone и open-ended self-modification остаются отложенными до появления подходящего compute/evidence gate.

## 9. Следующий технический фронт

Следующий большой проход должен связать replay с independent retention/transfer holdouts, memory-pressure driven eviction/residency и real-world consequence loop. Центральная цель: доказать не «какие воспоминания выбраны», а `selection → replay → changed representation/skill → delayed retention → transfer → identity stability → restart continuity`.
