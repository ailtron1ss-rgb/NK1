# V97 — Plasticity Evolution

## Изменения
- AdaptiveLinearity: per-neuron gradient-flow-driven linearity candidate.
- SelectiveWeightRegeneration: selective low-utility weight reset + optimizer-state reset.
- FastSlowConsolidation: controlled fast→slow transfer with optional importance protection.
- Checkpoint schema сохраняет полный CurrentConfig.
- Stable frontier/package metadata подняты до V97 / 0.97.0.
- Current tests проверяют source package version и engine contract.

## Статус
Новые механизмы остаются candidate-only до long-horizon causal qualification.
