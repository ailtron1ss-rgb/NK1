# Release Notes B330

B330 усиливает causal learning: альтернативный результат теперь имеет явный provenance (`model` / `matched-simulated` / `external`) и promotion запрещён без минимум 3 matched trials на episode.

Также исправлен restore schema-version bug: `recoveryStrategy.version` всегда нормализуется к 3.

Real Core runtime получает matched-simulated evidence из того же pre-state, но пока остаётся ниже promotion gate: 1 matched trial на boot недостаточно.
