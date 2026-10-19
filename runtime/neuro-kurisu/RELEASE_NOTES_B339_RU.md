# Release Notes B339 — Self-Model Goal Coupling

B339 — функциональное улучшение causal self-model loop.

## Изменения

- SelfModelV2 теперь обучается от outcome внутренней цели.
- Добавлены persistent `goalAlignment01`, `goalAlignmentEMA01`, `selfConsistentAction11`.
- Добавлен bounded `actionBias(action)`.
- `OrganismCore` включает self-model bias в основной `rawUtility` до `DecisionActionPipeline`.
- Добавлены unit + real-runtime tests.
- Master audit и roadmap обновлены после перепроверки B338/B339.

## Evidence

PASS:
- B338 unit/runtime
- B339 unit/runtime
- typecheck
- core ownership
- architecture
- integrity

OPEN / не PASS:
- полный long-horizon autonomy
- полный syntax/contract bundle в этой сессии (execution timeout)
- Android/Termux physical-device proof
- long-horizon self-model holdout/ablation
