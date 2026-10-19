# CHANGELOG V111

- Проведена reference-objective ablation V110: predictive/world/spine/memory/self/multiscale дают измеримый вклад; confidence-calibrator и temporal regularizer — практически нет в short fixed-objective probe.
- Удалена отдельная `confidence_calibrator`; canonical confidence теперь один — `spine.confidence`.
- `temporal_weight` сохранён как совместимый research control, но default изменён на `0.0`; temporal smoothness больше не считается обязательной частью current objective.
- ABI 11, schema 22, neural version 111.
- Добавлены V111 lean-objective/invariant tests и benchmarks.
- Default synergy feedback остаётся выключенным; peer-consensus остаётся candidate-only.
