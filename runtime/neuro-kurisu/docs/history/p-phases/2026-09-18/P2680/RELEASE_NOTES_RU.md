# P2680 — Multiscale Causal Regime Fabric

## Реализация
- Добавлен B2526 Multiscale Causal Regime Graph.
- Добавлен B2527 Factorial Ablation Harness.
- B2525 transition learning и B2526 regime learning интегрированы в NeuralExperienceBranch.
- Добавлены persistence/diagnostics/exports.
- State schema: 189.
- Release: 35.6.80.

## Проверка
- P2680 standalone/integration: PASS.
- Typecheck: PASS.
- Full audit: PASS.
- Architecture: PASS.
- Integrity: PASS.
- Forensics: PASS.
- Hygiene: PASS.
- Syntax: PASS.
- Release source: PASS.
- Archive manifest: PASS.

## Экспериментальные результаты
B2526: 1200 observations, 42 discovered regimes, 294 edges, 38 interventions, 35 useful interventions, transition confidence 0.8173, causal strength 0.6251.
B2527: 300 ablation experiments, 4 factors, interaction gain 0.0320.
Integrated branch: 40 cycles, 40 learned transitions, 6 discovered regimes.
