# NK1 WorkPass367 — проверка причинных связей provider revisions и external evidence

**Дата:** 2026-10-26  
**Ветка:** workpass367-receipt-reference-lineage  
**База:** WorkPass366 head `3fdb5eba48664f9004d29c3858355862aea8f4ae`  
**Статус:** initial CI нашёл mismatch схемы `tool` / `toolId` в новой проверке external evidence; исправлено в 6fee44aec4d2cbfef785105c567b685c38b481b5. Требуется fresh exact-head CI.

## Найденная проблема

В WorkPass366 форматы внешних наблюдений и provider revisions уже проверялись по schema и fingerprint, но в некоторых ветках restore/replay не требовалось подтверждать, что evidence всё ещё связано с правильной тройкой action/outcome/evidence. Существующий детерминированный event ID мог позволить принять узел с правильным ID/hash, но с изменённым parent edge, повторно как корректное свидетельство.

## Исправления

- External observation требует exact action/outcome refs, `external=true`, правильный execution/tool ID и parent edge в outcome.
- Provider revision требует связи с исходным outcome, правильного tool ID и корректного `previousRevisionEventId`; restore не принимает разорванную последовательность.
- `hasToolReceiptTrace()` теперь проверяет не только stage, но и execution identity, совпадение tool, оба causal edges и согласованность event-bound projection hashes.
- Existing-event/replay branches повторно проверяют lineage до восстановления идемпотентностной ссылки.

## Регрессии

- Подмена parent ID внешнего наблюдения и receipt-outcome link в payload.
- Подмена parent edge и `previousRevisionEventId` provider revision.
- Разрыв outcome→action исходной receipt-тройки после restore.

## Границы

- CHANGELOG и этот checkpoint добавлены в рабочую ветку; `main` и опубликованный Release ZIP не менялись.
- WorkPass367 требует отдельного exact-head runtime typecheck и canonical-kernel / learning-metrics CI; PASS заранее не заявляется.
