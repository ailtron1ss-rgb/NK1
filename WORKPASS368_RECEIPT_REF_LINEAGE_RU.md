# NK1 WorkPass368 — causal integrity ревизий и внешних наблюдений

**Дата:** 2026-10-26  
**Ветка:** workpass368-receipt-ref-lineage  
**База:** WorkPass367 exact head `87293b833d526e9244144107e5cb1770581e46d9`  
**Статус:** изменения и regression tests опубликованы; exact-head CI ожидает завершения.

## Обнаруженный разрыв

Restore проверял ID, stage и fingerprint у внешних наблюдений/provider revisions, но не требовал, чтобы их события оставались причинно связаны с исходным tool outcome. Replay path также возвращал `replayed=true` на основании index/ref, не перепроверяя parent links существующего узла.

## Изменения

- Внешнее наблюдение при restore/replay обязано быть `external-evidence`, иметь `external=true`, идентификаторы action/outcome из canonical index и parent link на исходный outcome.
- Provider revision при restore/replay обязана быть `tool-reconciliation`, ссылаться на исходный outcome и содержать совпадающий `baseOutcomeEventId`.
- Последовательность revisions сверяется по монотонному `revisionNumber`, полю `previousRevisionEventId` и фактическому parent edge к предыдущей revision.
- Повтор существующего события с тем же deterministic ID, но утраченными parent links отклоняется как lineage conflict; такой event не становится accepted idempotent replay.

## Регрессии

- Проверка валидной цепочки двух provider revisions и replay после restart.
- Подмена parentIds revision-события при сохранении его payload/event ID должна делать повторную ревизию конфликтной.
- Подмена parentIds внешнего observation должна делать повтор наблюдения конфликтным; canonical исходная receipt-тройка при этом остаётся валидной.

## Проверка и границы

- CI WorkPass331 и WorkPass110 должны завершиться на точном WorkPass368 head; ранее пройденный WorkPass367 CI не переносится автоматически.
- CHANGELOG и checkpoint обновлены; `main` и опубликованный Release ZIP не менялись.
