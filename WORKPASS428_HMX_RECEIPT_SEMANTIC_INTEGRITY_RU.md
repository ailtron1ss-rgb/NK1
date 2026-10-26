# NK1 WorkPass428 — семантическая целостность HMX apply receipt

**Дата:** 2026-10-26  
**Ветка:** workpass428-hmx-receipt-semantic-integrity  
**База:** consolidated Hexis/restore branch `fix/outcome-projection-index-restore-2026-10-26`, PR #236 head `947805d03fed8b3b51893018f2db0fa3a38c3bf0`  
**Статус:** код и регрессии опубликованы; exact-head CI ожидает проверки.

## Найденные дефекты

- HMX receipt валидировался по digest и структуре полей; при повторном пересчёте SHA-256 можно было представить невозможные counters/status как внутренне согласованные.
- deferredRelationships мог расходиться с deferredSections.relationships, а phantom/zero-count section keys не соответствовали реально отложенным данным.
- memoryIds, createdMemoryIds и semanticEdgeIds допускали пустые/whitespace-only элементы.
- deferredSectionCounts() складывал имена внешних разделов в обычный {}; ключ __proto__ не сохранялся как обычное собственное поле.
- Экспортированный isValidHmxApplyReceipt() мог вызываться напрямую с accessors и не проверял весь контракт stage самостоятельно.

## Реальные изменения

- На consolidated integration line перенесены WorkPass426 проверки applicationAttempts и соответствия receipt.attempt счётчику этапа, плюс WorkPass427 инварианты memory/edge counters.
- isValidHmxApplyReceipt независимо проверяет integrity stage, безопасное JSON-дерево receipt, состояние applied + port/additive и обязательную идентичность HMX stage.
- Deferred section summary сравнивается точь-в-точь с вычисленной проекцией stage; relationship counters обязаны покрывать staged relationship array и совпадать с deferred section entry.
- ID-массивы должны содержать уникальные непустые канонические строки; пустые строки и управляющие символы запрещены.
- Словарь deferred sections теперь имеет null prototype, сохраняя будущие имена секций вроде __proto__.
- hexis-canonical-apply.yml запускается и для stacked PR на текущей consolidation branch, а не только для PR в workpass70-source.

## Регрессии

- Невалидные attempt counters и receipt/stage attempt mismatch.
- Перехешированные impossible receipts, пустые ID, phantom/zero deferred sections и несовпадающий relationship deferred count.
- Прямой вызов exported validator с getter-backed stage/receipt без выполнения getters.
- Реальный projector apply для stage с собственным ключом __proto__; ключ обязан остаться в receipt и пройти validation.

## Границы

- Изменены projector, stage validator/type declaration, regression test, CI trigger, CHANGELOG и этот checkpoint.
- Exact-head CI ещё не завершён; локальный запуск не заявляется.
- main и опубликованный Release ZIP не менялись; релизная готовность остаётся открытой.
