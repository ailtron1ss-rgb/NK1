# NK1 WorkPass365 — целостность квитанций действий и атомарность журнала

**Дата:** 2026-10-26  
**Ветка:** workpass365-atomic-receipt-projection  
**База:** WorkPass364 branch `workpass364-event-fabric-append-ingress`, текущий checkpoint head 73fb4acbc90e1e0735cd55a43d00f2603ee694a8  
**Статус:** реализовано; exact-head CI ожидает проверки. PASS не заявляется.

## Найденные дефекты

- `appendToolReceiptTrace()` преобразовывал `"false"` к `true`, округлял ticks и мог принять повреждённую строку как проверенное evidence.
- Полный `projectionHash` находился в replay index, но не был привязан к трём причинным событиям. Восстановление index поэтому не могло сверить его с immutable action/outcome/evidence nodes.
- Три append-записи выполнялись последовательно без транзакционного отката при ошибке посередине.

## Реализация

- Снимок входных полей через собственные data descriptors: accessor-поля отклоняются без выполнения getters.
- Строгая проверка tick, at, IDs, tool ID, типов boolean, confidence и длины текстовых postconditions.
- Локализация postcondition с NFKC и locale-independent lowercase перед хешированием; сырой текст postcondition не сохраняется.
- Проекционный hash пишется в action, outcome и evidence; на evidence сохраняются только хеши ожидаемого/наблюдаемого postcondition.
- Restore отбрасывает индекс, если event-bound fingerprints расходятся. Старая схема без hash-полей сохраняет совместимость.
- Обёртка `withAtomicLedgerMutation()` возвращает событие/счётчик/replay index к предыдущему состоянию при ошибке в середине трёх записей.

## Регрессии

- Некорректные ticks/ID/booleans/confidence/at/postconditions не меняют журнал.
- Повтор receipt и replay после restore не создают дубликатов.
- Изменение hash в индексе или evidence-событии запрещает восстановление replay guard.
- Искусственная ошибка на втором append подтверждает rollback трёхсобытийной записи.

## Проверка и границы

- Добавлен checkpoint и CHANGELOG; `main` и опубликованный Release ZIP не менялись.
- WorkPass364 exact-head CI должен завершиться отдельно; этот новый WorkPass365 head требует своих запусков TypeScript и canonical kernel/learning metrics.
- Это усиление целостности причинного evidence, а не доказательство измеренного прироста интеллекта или полной готовности релиза.
