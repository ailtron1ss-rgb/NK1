# WorkPass344 — восстановление часов графа когнитивных зависимостей

Дата: 2026-10-26  
Ветка: `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
Code/test commit: `5b86768a67c3893e6c76c044bffe822aa41e14ae`  
Статус: **код и регрессии добавлены; точный CI для этого SHA пока не подтверждён**.

## Что исправлено

В `CognitiveDependencyGraph` обнаружен тот же класс ошибки, что в WorkPass343 для `UnifiedCognitiveSubstrate`: сохранённый derived-sidecar мог содержать корректный по типу, но недостижимый будущий `lastTick`. Runtime использовал этот тик для формирования следующего кадра, поэтому после восстановления sidecar мог навсегда вывести routing-frame за диапазон безопасных целых, и `resolve()` начинал отклонять кадры.

Добавлен `reconcileLastTick(canonicalTick)`. Он проверяет канонический тик, а если sidecar ушёл вперёд — переназначает только `lastTick`. Wake mask, счётчики переходов по доменам, причина, состояние прерывания и история остаются на месте. `OrganismRuntime.init()` выполняет восстановление сразу после загрузки graph sidecar и пишет диагностическое событие `runtime.cognitive-dependency.tick-reconciled`.

## Регрессии

- Unit-тест восстанавливает `Number.MAX_SAFE_INTEGER`, сверяет сохранность routing counters, wake mask и активного safety interrupt, отклонение некорректного canonical tick и успешный следующий кадр.
- Runtime restart smoke повреждает **оба** sidecar (`cognitive-substrate` и `cognitive-dependencies`) одинаковым будущим тиком, создаёт новый `OrganismRuntime`, проверяет re-anchor и выполняет следующий автономный шаг.
- Workflow `cognitive-integration-suite.yml` включает `organism-smoke.mjs` в path-фильтры как для PR, так и для push. Команда `test:unified-substrate-runtime-wiring` уже запускает unit-контракт и runtime smoke вместе.

## Проверка и ограничения

На момент чекпоинта GitHub connector не вернул workflow runs или commit status checks для code/test SHA `5b86768a67c3893e6c76c044bffe822aa41e14ae`; поэтому тесты не помечаются как прошедшие и сводные проценты не увеличиваются. Исторические 13 успешных прогонов относятся к code/test SHA `621864d0d7f2676245383adab86f1dcc6d0f741f`, а не к этому изменению.

WorkPass344 не изменяет каноническую модель Core и не даёт графу права выбирать действие. Главная ветка остаётся без изменений; PR #145 остаётся draft до точной проверки и остальных релизных ворот.
