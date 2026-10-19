# Neuro/Kurisu 35.7.7 — P2707

## Главный апгрейд

P2707 добавляет экспериментальный multi-timescale learning layer прямо в `NeuralExperienceBranch`.

### Код

- state schema neural branch: 17 → 18;
- два новых cascade eligibility уровня;
- per-neuron astrocyte-like slow plasticity gate;
- adaptive credit mixture;
- экспериментальный ablation switch;
- новые diagnostic metrics;
- delayed-credit test;
- factorial matched benchmark.

### Проверка

- `P2707_CASCADE_EXPERIMENTAL_LAYER=PASS`
- `P2707_FACTORIAL_LEARNING_BENCHMARK=PASS`
- `npm run typecheck` = PASS

### Интерпретация результата

Экспериментальный слой реально меняет learning trajectory и остаётся численно стабильным. На текущем synthetic factorial benchmark он пока не показал улучшения `generalization01`, поэтому не объявляется доказанным превосходством. Это сознательно сохранённый experimental path с обязательным ablation/holdout gate.

## Research integration

Сохранены в `RESEARCH/2026-09-20/`:
- P2707 synthesis;
- новые источники ICLR 2026 / AGMP 2026 / self-normalizing STDP 2026 / active inference 2026;
- критерии следующего delay-sweep эксперимента.
