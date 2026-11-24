# Neuro-Kurisu 34.76.0 — BIG PASS 102

## Memory Replay / Consolidation Substrate

Добавлен ограниченный replay-контур поверх ExperienceContinuumFabric. Он ранжирует производные узлы опыта по значимости, prediction impact, future relevance, identity impact и возрасту; replay budget ограничен для мобильного runtime.

Добавлены `stability01` и `replayPriority01`, bounded replay metrics и Core API для получения replay candidates и реактивации производного memory node.

Каноническая MemoryOS2 не заменяется и не изменяется этим слоем. Replay не считается доказательством биологической консолидации или субъективного опыта.

Schema ExperienceContinuum повышена до v3 с backward-compatible migration.
