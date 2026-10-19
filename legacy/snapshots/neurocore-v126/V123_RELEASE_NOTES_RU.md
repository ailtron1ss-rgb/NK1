# NeuroCore V123 — Decontamination / Anti-Stub Pass

## Реальные изменения
- Удалён no-op `NeuralLifecycleController.observe`: внешний observer теперь действительно обновляет lifecycle statistics.
- Удалена пустая `pass`-ветка из validation-кода temporal credit.
- Enabled sparse-memory configs с нулевым read influence теперь отклоняются как поведенчески инертные.
- Synergy workspace больше не вычисляется и не экспортируется на default path при нулевой feedback; он исполняется только при активной synergy/diagnostics.
- AdaptiveLinearity теперь принимает базовую нелинейность, поэтому `mamba3_heavy_tail` не теряется при одновременном включении adaptive linearity.
- ExecutionProfiler больше не помечает параметры method-driven модулей как неиспользуемые только потому, что модуль запускается через `.step()`.
- Добавлен runtime liveness probe для проверки, что опции действительно меняют вычислительное поведение.

## Статус
V123 не добавляет новый memory owner. Цель прохода — очистить current от ложной функциональности и зафиксировать реальные behavioral contracts.

## Anti-decoration qualification

V123 отдельно проверяет отсутствие исполняемых `pass`/`NotImplementedError`, инертных включённых конфигураций и режимов, которые заявлены, но не меняют вычисление. Текстовый аудит заменён AST-проверкой, чтобы docstring/comment не считались заглушками.
