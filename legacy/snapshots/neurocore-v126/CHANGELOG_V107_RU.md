# NeuroCore V107 — Causal Trunk

## Главное

V107 впервые делает current path самостоятельным по коду: `NeuroCoreCurrent` больше не создаёт V88/VXX engine. Исторические версии остаются только в `history/` и migration/reference surface.

### Реальные изменения

- Добавлен standalone `CausalTrunk`.
- Один текущий associative recurrent spine владеет динамическим neural state.
- Predictive/world/self/multiscale/memory/confidence heads работают поверх одного trunk.
- Удалён legacy replay/world/planner execution path из current constructor.
- Batch-dependent multiscale state больше не является checkpoint buffer.
- Online fast plasticity теперь обновляется **внутри временного цикла после текущего prediction**, поэтому её update влияет только на следующие шаги.
- Добавлен `ExecutionProfiler` и parameter-level gradient coverage.
- Добавлен V107 benchmark против V106.
- Current suite переписан под новый trunk; V106 current tests сохранены отдельно в `history/tests_v106_current/`.
- Синхронизированы release/version metadata.

## Квалификация

- Current tests: 15/15 PASS.
- Total parameters: 72,821.
- Trainable parameters: 71,282.
- Gradient parameter coverage: 99.9888% в representative learning run.
- Named modules: 70; вызваны 60 (85.7%).
- V106: 367,437 total / 159,870 trainable / 1,951 named modules.
- На одинаковом CPU-протоколе measured forward-learning pass стал примерно 8.3× быстрее.

## Ограничения

V107 не объявляет solved long-horizon credit assignment. Temporal-credit modes остаются экспериментальными. Event bank, QED/address erase и uncertainty-aware write по-прежнему candidate-only.
