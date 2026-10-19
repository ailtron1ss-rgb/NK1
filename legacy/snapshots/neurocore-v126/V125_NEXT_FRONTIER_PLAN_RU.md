# V125 → V126

## Следующий проход

**V126 — Memory Consolidation + Sparse State Runtime + Continual Learning**

1. Иерархическая fast→persistent консолидация внутри единого memory owner, без второго независимого memory truth.
2. Sparse/segmented runtime state, чтобы ёмкость памяти не превращалась в постоянную materialization overhead.
3. Более сильная collision qualification: много событий, hot/cold slots, overwrite, distribution shift.
4. End-to-end retrieval training с реальными ключами/значениями и длинными горизонтами.
5. Пластичность и selective regeneration только через continual-learning evidence.
6. Mobile CPU benchmark: память, latency, allocations, tokens/sec.

Promotion gate: механизм входит в current только при измеримом улучшении качества при приемлемой вычислительной стоимости и прохождении decontamination.
