# Neuro/Kurisu 35.17.0 — P2805

Новый слой: Stability / Plasticity / Weight-Space Consolidation.

## Production

- `P2805StabilityPlasticityArbiter` встроен в `NeuralExperienceBranch`.
- Sparse/protected neuron learning gate.
- Context-aware plasticity/stability scales.
- Slow action-readout and edge-weight references.
- Bounded teacher pull.
- Selective dormant/low-utility weight reset.
- Resource-aware reset budget.
- Replay compatibility/interference guard.
- Persistence + restart.

## Evidence

`P2805_STABILITY_PLASTICITY=PASS`

`P2805_FACTORIAL=PASS`

`TYPECHECK=PASS`

Полная release validation выполняется раздельными чистыми процессами для тяжёлых runtime-тестов, чтобы не путать общий Node resource pressure с регрессией кода.
