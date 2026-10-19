# PASS 15 — Runtime residency / hot-path pass

Дата: 2026-10-01

## Что реально изменено

1. `OrganismResourceAllocator.decide()` получил внутренний режим `{ clone:false }`. Planner использует detached planning-представление вместо полного `structuredClone`.
2. `InteroceptiveStateEstimator` теперь сохраняет уже созданный текущий frame без второго clone внутри `observe()`; durable projection использует отдельную `persistenceSnapshot()`.
3. `CognitiveDependencyGraph.resolve()` перестал делать глубокую копию маленького interrupt-объекта: сохраняется отдельная shallow-копия массива `domains`.
4. В hot-path остаются public `snapshot()`-границы без изменения их контрактов; оптимизации ограничены внутренними planning/durability путями.
5. Дубликат PASS14 release-note в `docs/r19` удалён: там оставлена отдельная навигационная запись, чтобы forensics не считал документацию duplicate-content.

## Измеренный результат

128-cycle runtime gate после прохода:
- elapsed: 23.87 s
- first 16 cycle mean: 222.34 ms
- last 16 cycle mean: 161.83 ms
- ratio: 0.728
- peak RSS: 438,374,400 bytes (~418 MiB)
- peak heapUsed: 291,517,176 bytes (~278 MiB)

Для сравнения с предыдущей диагностикой этого же прохода до финальной очистки: peak RSS был ~465 MB, peak heap ~324 MB. Это примерно −5.7% по RSS и −10% по peak heap на том же 128-cycle gate.

Дополнительно 256-cycle loop без restart boundary прошёл за ~30.76 s, peak RSS ~507 MB; после flush ~508 MB. Этот результат используется как stress datapoint, но не как R19 restart PASS.

## Проверки

PASS:
- `npm run typecheck`
- P34 causal personhood
- R26 observation stage
- R26 neural substrate
- R25 NeuroCore architecture integration
- P2887/P2888/P2889/P2890/P2891 regression gates
- P2842 calibration
- P2855 contextual policy
- smoke
- core ownership
- architecture
- forensics
- hygiene
- executable syntax
- integrity
- release contract
- release source
- anti-decoration

## Ограничение / честный статус

Полный `p2895-r19-long-horizon` restart gate в текущем runtime-окружении не удалось воспроизвести до завершения: orchestration timeout произошёл на длинной 256-cycle persistence/restart проверке. Сам 256-cycle cognitive loop без restart boundary доходит до 256 и завершается; поэтому R19-256 restart здесь НЕ маркируется PASS.

Также агрегатор `release:r26:core` в этой среде timeout'нулся на шаге orchestration после успешных первых этапов; отдельные R25/integrity/contract/source/anti-decoration проверки прошли напрямую.

## Следующий технический шаг

Не расширять snapshot-рефакторинг вслепую. Следующий проход — инструментальная разбивка durable state по стоимости `store.save/load`, затем точечная оптимизация persistence boundary для тех projection-групп, которые реально дают нелинейный рост на 256-cycle restart, с отдельным regression gate на восстановление.
