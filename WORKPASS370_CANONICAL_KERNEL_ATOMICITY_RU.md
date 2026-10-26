# NK1 WorkPass370 — атомарные записи canonical kernel

**Дата:** 2026-10-26  
**Ветка:** workpass370-atomic-kernel-cycles  
**База:** WorkPass369 head `e14f04d179b85bc57b1793468ac4988c2843a867`  
**Статус:** код и регрессии опубликованы; exact-head CI ожидает проверки.

## Найденный пробел

WorkPass369 сделал атомарным `CognitiveEventFabric.recordOperationalCycle()`, но live-путь `CanonicalCognitiveKernel.beginDecisionCycle()` отдельно записывает восемь событий, а `completeCycle()` — outcome/learning/self-update. Ошибка посреди любого из этих последовательных append могла оставить partial trace. В completeCycle при последующей ошибке могла разойтись и aggregate-состояние `UnifiedCognitiveCycle`.

## Исправления

- `CognitiveEventFabric.withAtomicLedgerTransaction()` создаёт синхронную транзакционную границу вокруг записи и всех последующих проверок.
- `beginDecisionCycle()` использует одну транзакцию на восемь стадий.
- `completeCycle()` оборачивает три финальных append, lineage validation и `UnifiedCognitiveCycle.evaluate()`; при исключении он также восстанавливает снимок агрегатного cycle ledger.
- Promise/thenable из transaction callback отклоняется, потому что rollback не может надёжно пересечь `await`.

## Регрессии

- Искусственная ошибка на четвёртом событии decision приводит к точному возврату пустого CEF; retry пишет ровно 8 событий.
- Искусственная ошибка на втором событии completion откатывает и события, и агрегатные счётчики; retry завершается без дублей.
- Проверка асинхронного callback убеждается, что transaction не завершает запись преждевременно.

## Границы

- CHANGELOG/checkpoint добавлены; `main` и published Release ZIP не менялись.
- Требуются exact-head TypeScript, canonical cognitive-kernel, smoke/restart и learning-metrics workflows.
