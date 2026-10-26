# NK1 WorkPass372 — безопасное восстановление и оценка UnifiedCognitiveCycle

**Дата:** 2026-10-26  
**Ветка:** workpass372-unified-cycle-ingress  
**База:** WorkPass371 head `1fe10507407559b9edb14f3d96e2ce0f1a6b449c`  
**Статус:** первый contract CI выявил изменение прежнего error text для null/array evaluation input; восстановлен исходный guard в 1db6758619cc71b2728ea84d5c76fb02c3d55822. Exact-head CI перепроверяется.

## Найденные проблемы

- `restore()` напрямую читает persisted fields, поэтому accessor-backed counters/version/lastComplete могли выполняться во время восстановления.
- `lastMissingStages` читался обычными `.some()`/`.filter()`, которые выполняли getter на элементах массива.
- `evaluate()` напрямую читает `input.tick`, `parentIntegrity01` и `input.stageIds[stage]`; getter можно было исполнить, пока агрегат формирует решение о полноте цикла.
- Собственное `version: undefined` воспринималось как отсутствие версии, хотя это повреждённый schema field.

## Исправления

- Own-data descriptor snapshots для persisted state, evaluation root и stage-ID map.
- Snapshot безопасного массива `lastMissingStages`, отклонение accessor slots до замены state.
- Различение отсутствующего `version` и присутствующего невалидного значения.
- `restore()` полностью готовит `nextState` локально и только затем присваивает `this.state`.
- `evaluate()` читает все values из snapshot; stage IDs должны быть собственными data fields, inherited/accessor values не являются evidence.

## Регрессии

- Getter-тесты для persisted `cycles`, `lastMissingStages[0]`, evaluation tick, stage ID и parentIntegrity01.
- Каждый отказ проверяет, что исходный aggregate state не изменился и getters не исполнились.
- Валидный snapshot round-trip и следующая evaluation проходят, подтверждая, что исправление не блокирует штатное продолжение цикла.

## Границы

- CHANGELOG/checkpoint обновлены; `main` и published Release ZIP не менялись.
- Нужны exact-head TypeScript, canonical-kernel/smoke/restart и continual-learning CI.
