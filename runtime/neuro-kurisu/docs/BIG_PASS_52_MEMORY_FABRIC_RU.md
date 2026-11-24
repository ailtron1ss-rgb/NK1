# Neuro-Kurisu 34.23.0 — BIG PASS 52: Memory Fabric

## Цель
Объединить память вокруг одного канонического runtime-хранилища без создания второй базы данных, снизить стоимость retrieval на среднем телефоне и добавить наблюдаемость.

## Реально внедрено
- `MemoryFabric` — единый coordinator/API над `MemoryOS2`, без второго durable store.
- `OrganismCore` использует Fabric для canonical encode/retrieve/maintenance и P62 recall orchestration.
- `MemoryOS2` получил bounded token inverted index и candidate pruning.
- `MemorySubsystemRuntime` владеет Fabric и сохраняет его lightweight runtime snapshot.
- Memory mutations/retrieval/maintenance получили event-visible trail без копирования всей памяти в telemetry.
- Hot-cache ограничен 32 элементами по умолчанию и не участвует в identity semantics.

## Проверка
- TYPECHECK=PASS
- BIG_PASS_52_MEMORY_FABRIC=PASS
- BIG_PASS_52_MEMORY_INDEX=PASS
- ORGANISM_SMOKE=PASS
- MEMORY_DEDUP=PASS
- RESTART_PERSISTENCE=PASS

## Benchmark индекса
На 1600 записей retrieval использовал 96 кандидатов (94% pruning); отдельный benchmark retrieval составил около 4.66 ms. Это не эквивалентно ускорению всего организма и не заменяет device benchmark на Android.

## Принцип источника истины
`MemoryOS2` остаётся canonical authority. `MultiTimescaleMemory`, P62 и compatibility projections являются производными/read-side слоями.
