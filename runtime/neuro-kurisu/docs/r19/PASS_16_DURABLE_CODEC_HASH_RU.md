# R19 / PASS16 — запись durable-подсистемы

Дата: 2026-10-01

## Durable codec

`MemoryStateStore` использует V8 binary serialization только для in-process persistence. Payload хранится отдельно от live object graph, а `load()` каждый раз создаёт detached состояние.

Проверено:
- изоляция исходного состояния;
- изоляция загруженного состояния;
- сохранение `Map`, `Set` и `undefined`;
- измерение payload/save metrics.

## Integrity

`IntegritySentinel` формирует тот же canonical hash material, что и прежняя streaming-реализация. Root-level `system` исключён; object keys сортируются; массивы сохраняют порядок.

Есть regression test на эквивалентность digest старого и нового алгоритма.

## Projection

B365 snapshot вычисляется один раз на projection context и повторно используется в neural persistence bundle.

## R19 status

P2892, P2893, P2894 и прямой P2895 256-cycle/restart gate пройдены. Агрегатор R19 не считается PASS из-за внешнего timeout orchestration; прямые regression gates P2887–P2891, P2842 и P2855 пройдены отдельно.
