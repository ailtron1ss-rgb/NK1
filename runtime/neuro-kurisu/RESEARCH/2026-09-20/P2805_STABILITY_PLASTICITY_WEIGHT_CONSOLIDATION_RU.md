# P2805 — Stability/Plasticity + Weight-Space Consolidation

Дата: 2026-09-20
Релиз: 35.17.0 / P2805

## Цель

После P2774 система уже умела планировать replay по model-time и переносить повторяющиеся эпизоды в slow memory. Следующий риск — replay/interference может одновременно уменьшать forgetting и ухудшать plasticity или даже усиливать interference.

P2805 добавляет в реальную `NeuralExperienceBranch` лёгкий on-device stability/plasticity arbiter:

`context + novelty + uncertainty + forgetting + replay pressure -> plasticity/stability state -> neuron gate -> sparse learning -> slow weight reference -> selective reset -> replay compatibility`

## Реализовано

1. Context-aware plasticity scale.
2. Stability scale и conflict pressure.
3. Local neuron importance / availability / activity tracking.
4. Sparse/protected update gate.
5. Slow action-readout reference.
6. Slow edge-weight reference.
7. Weight-space teacher pull.
8. Selective reset кандидатов с низкой полезностью.
9. Replay compatibility gate — replay может быть ограничен при высоком interference risk.
10. Resource-aware reset budget.
11. Persistence и restart.
12. Полная ablation: отключение P2805 оставляет старый path.

## Research basis

### Weight Space Consolidation — ICLR 2026
Идея: стабильность можно усиливать averaging/consolidation, а пластичность восстанавливать точечным reset малозначимых параметров.
Источник: https://proceedings.iclr.cc/paper_files/paper/2026/hash/17fc58b1ba92abbb72c5f457e140d851-Abstract-Conference.html

### Reinitializing weights vs units — L2RL 2026
Работа показывает, что selective weight reinitialization может быть особенно полезным при loss of plasticity и в небольших сетях.
Источник: https://proceedings.mlr.press/v330/hernandez-garcia26a.html

### Wake the Sleeping Weights — CVPR Findings 2026
Источник использует идею sparsely activating inactive parameters вместо равномерного online update.
Источник: https://openaccess.thecvf.com/content/CVPR2026F/html/Ji_Wake_the_Sleeping_Weights_Sparsely-Activated_Continual_Test-Time_Adaptation_for_Medical_CVPRF_2026_paper.html

### Context selectivity + dynamic availability
Нейронная метапластичность через context selectivity и availability используется как биологически вдохновлённый принцип контроля пластичности.
Источник: https://www.sciencedirect.com/science/article/pii/S0893608025006082

### Replay can provably increase forgetting
В некоторых условиях replay не гарантирует уменьшение forgetting; выбор replay samples и их timing критичны.
Источник: https://proceedings.mlr.press/v330/mahdaviyeh26a.html

### FOREVER model-time replay
Model-time replay привязывает replay schedule к фактическим изменениям модели, а не к raw step count; P2774 уже адаптирует этот принцип.
Источник: https://aclanthology.org/2026.acl-long.1144/

## Экспериментальные доказательства

`P2805_STABILITY_PLASTICITY=PASS`

Direct run:
- learningEvents=6240
- consolidatedWeights=933
- sparseUpdates=6134
- protectedUpdates=106
- resetPressure=0.3463
- stressResetPressure=0.5309
- branchEvents=156
- trajectoryDiff=0.0120
- restart=156

`P2805_FACTORIAL=PASS`

Проверены отдельные режимы control/gate/teacher/full. Это не доказывает универсального превосходства, но подтверждает, что составляющие действительно дают разные механические режимы.

## Ограничения

- Synthetic factorial; не переносить результаты напрямую на реальное Android-устройство.
- Прямой gain не равен «проценту сознания».
- Replay/stability эффекты task-dependent.
