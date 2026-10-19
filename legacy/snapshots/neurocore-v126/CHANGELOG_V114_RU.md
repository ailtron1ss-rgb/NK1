# V114 — Optimizer Alignment Audit

- Исправлен скрытый `NameError` в `GradientArbitrator.arbitrate()`, из-за которого реальный arbitrated training мог падать после успешного `inspect_conflicts()`.
- Добавлен реальный аудит `gradient -> applied AdamW update mismatch`.
- Добавлен candidate-only bounded post-update alignment для selected probe parameters; decoupled weight decay сохраняется отдельно.
- Добавлены bounded iterative projections и отдельные diagnostics raw/post conflict.
- Сохранён default-off режим: новый механизм не меняет основной путь без явного флага.
- Исправлен audit logical activity для custom method-driven owners.
- `state_update_cosine_zero` переименован в семантически корректный `state_update_cosine_prev`.
- V113 current checkpoint schema повышена до 25; ABI до 14.
