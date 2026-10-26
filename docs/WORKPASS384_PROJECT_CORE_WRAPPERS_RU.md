# WorkPass384 — проектные действия через канонические Core wrappers

**Дата:** 2026-10-26  
**Кодовый HEAD:** 17d89d3e464689b8d3466f8598cdb37b3ee79bbe  
**Статус:** маршрут изменён; Repository Wiring Audit прошёл, полный WorkPass71 был отменён до вывода.

## Изменение

- Свежая project operation вызывает `this.executeTool(id, input, reason, options)`.
- Resume ранее начатой операции использует `this.reconcileToolExecution(...)`, а не execution API.
- Это возвращает alias normalization к единому Core owner и сохраняет разделение execute vs receipt-only reconciliation. Project operations используют stable operation idempotency key; keyed finalization остаётся внутри ActionGateway и не дублируется wrapper.

## Валидация

WorkPass71 ранее прошёл causal replay wiring и WP95/WP96, но остановился на статической проверке WorkPass97, которая ожидала core wrapper. Обновлённый путь внесён в `OrganismCore.ts`. Repository Wiring Audit на HEAD `17d89d3…` прошёл; полный WorkPass71 был отменён инфраструктурой. Нужен новый exact-head run.

`main` и опубликованный Release ZIP не изменялись.
