# NeuroCore V119 — Финальный интегрированный релиз

Дата: 29.09.2026

V119 объединяет проверенные изменения V106–V118 в одном current trunk и добавляет causal HiPPO/history state, HiPPO+cascade hybrid credit и product-key sparse memory как отключаемые исследовательские кандидаты.

Ключевые проверенные факты:
- 50/50 current tests PASS.
- current frontier: V119.
- 69 137 параметров, 69 137 trainable.
- 100% gradient-element/parameter coverage в проверенном representative learning path.
- 1 canonical recurrent owner.
- 0 duplicate state keys.
- 0 legacy imports в current path.
- checkpoint round-trip: 107/107 tensors, без missing/shape mismatch/unexpected.
- current called-module fraction: ~90,16%.

Кандидаты HiPPO, hybrid credit, product-key memory, synergy feedback, event-bank и optimizer-update alignment сознательно не переводятся автоматически в default: их долгосрочное превосходство ещё требует matched benchmarks.

См. `evidence/V119_FINAL_INTEGRATION.json` и `V119_NEXT_FRONTIER_PLAN_RU.md`.
