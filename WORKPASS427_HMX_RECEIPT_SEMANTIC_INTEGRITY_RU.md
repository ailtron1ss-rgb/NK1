# NK1 WorkPass427 — семантическая целостность HMX apply receipt

**Дата:** 2026-10-26  
**Ветка:** workpass426-hmx-attempt-counter-integrity-v2  
**Зависимость:** WorkPass426 на том же draft PR #239  
**Статус:** реализация и регрессии опубликованы; exact-head CI требуется.

## Дефект

До этого `isValidHmxApplyReceipt` проверял структуру полей и сам digest. Но digest не является подписью: persisted receipt с заведомо невозможными счётчиками можно изменить и пересчитать digest, сохранив структурно валидный объект. Это позволяло утверждать `complete=true` для `noop`, либо `importedCount` без соответствующих ID.

## Изменения

- `candidateMemoryRecords` должен совпадать с размером staged memory array, `uniqueMemoryRecords` не превышает candidate count.
- `importedCount + deduplicatedCount = uniqueMemoryRecords`; длины `memoryIds`/`createdMemoryIds` соответствуют счётчикам, IDs уникальны, `createdMemoryIds` является подмножеством `memoryIds`.
- `semanticEdgeIds.length` не превышает projected relationship count; если relationships заданы массивом, `projected + deferred` покрывают все строки.
- State machine проверяется отдельно: zero unique rows → `noop`/incomplete; rows плюс deferred sections → `partial`/incomplete; только rows без deferred sections → `applied`/complete.

## Регрессии

- Перехешированные, но семантически невозможные receipt-варианты отклоняются.
- Когерентная квитанция непустого application replay принимается, при этом replay по-прежнему не вызывает canonical storage.
- Комбинация WorkPass426 проверяет malformed attempt counter и несовпадение receipt attempt/counter до любых записей.

## Проверка и границы

- Эти тесты добавлены в существующий Hexis canonical projector test, который должен выполняться в exact-head CI.
- До завершения runner checks PASS не заявляется; `main` и опубликованный Release ZIP не менялись.
