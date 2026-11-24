# PASS18 — Persistence History Projection

## Цель
Снизить durable payload и transient allocation на длинном жизненном цикле, не урезая рабочие runtime-history самих подсистем.

## Изменения
- P51 получил отдельную `persistenceSnapshot()`: recent evidence ограничивается 64 строками; live evidence window остаётся полной bounded-историей.
- P52 получил отдельную persistence projection: trajectory ограничивается 64 recent samples; bounded counterfactual set сохраняется отдельно.
- P61 получил persistence projection с 32 recent frames вместо записи полного 96-frame working window.
- P64 получил persistence projection с 32 recent frames вместо полного 128-frame working window.
- P65 получил persistence projection: сохраняются все currently unresolved predictions + bounded recent claim tail; `recentIds` ограничен 256.
- `PersistenceProjectionCoordinator` теперь использует эти persistence boundaries; добавлен отсутствовавший `p52CounterfactualDevelopment` в projection context.

## Ключевой принцип
Runtime state не урезается. В durable store сохраняется отдельная detached projection, достаточная для restart/continuity и диагностики.

## Измерение
На 256 cycles + V8 FileStateStore + restart:
- PASS
- restartedTick=257
- payloadBytes≈5.19 MiB
- peak RSS≈461.4 MiB
- PASS17 контроль: payload≈5.44 MiB, peak RSS≈474 MiB

На 96-cycle projection regression:
- live P61 frames=96; persisted=32
- live P64 history=96; persisted=32
- persisted P51 evidence=64
- persisted P52 trajectory=64
- persisted P65 claims=104, recentIds=104
- restart tick=96

## Известный отдельный дефект baseline
`tests/p64-p65-integration.mjs` уже падает на чистом PASS17 с `P64 did not participate in runtime`; это pre-existing issue runtime/operational scheduling и не вызван PASS18.

## Что дальше
Следующий кандидат — P52 counterfactual retention и крупные residual branches (`P68`, `P63`, `P49`, `P62`) после подтверждения их реальных consumers.
