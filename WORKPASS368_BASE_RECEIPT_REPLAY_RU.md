# NK1 WorkPass368 — fail-closed replay исходной receipt-тройки

**Дата:** 2026-10-26  
**Ветка:** workpass368-receipt-replay-fail-closed  
**База:** WorkPass367 head `08615f53c6075640b6a848d81b1d112e937240e4`  
**Статус:** код и регрессии добавлены; exact-head CI ожидает проверки.

## Дефект

`appendToolReceiptTrace()` при наличии индекса использовал три слота `priorNodes`. Если индекс оставался, но все указанные события отсутствовали, `candidateNodes.some(Boolean)` был false, и код мог создать новую тройку с тем же execution ID вместо отказа и reconciliation.

Дополнительный вопрос совместимости: pre-WorkPass365 snapshots могли хранить только признак наличия postconditions, не хешируя их значение. По таким данным нельзя доказать идентичность непустого expected/observed postcondition при replay.

## Изменения

- Broken indexed trace теперь всегда fail-closed, даже если не найден ни один из трёх узлов.
- Replay дополнительно сверяет execution ID/tool в каждой ноде, external flags, базовый causal chain и решение-предок.
- Старые snapshots без event-bound hashes можно повторить только при отсутствии содержимого postconditions; если postcondition непустой, возвратится conflict вместо недоказуемой idempotent-success.

## Регрессии

- Повреждённый индекс без существующих target nodes не увеличивает `total` и не создаёт дубликат.
- Hashless legacy receipt без postconditions сохраняет совместимость.
- Hashless legacy receipt с nonempty postconditions отклоняет replay, потому что сохранённых данных недостаточно для проверки точного совпадения.

## Границы

- CHANGELOG/checkpoint добавлены; `main` и published Release ZIP не менялись.
- WorkPass368 требует своего exact-head runtime typecheck и canonical-kernel / metrics CI.
