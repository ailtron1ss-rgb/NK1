# P2720 — Adaptive Lifelong Neuroplasticity

## Цель

P2720 связывает несколько механизмов в один управляемый контур: контекстную селективность, локальную доступность пластичности, selective/sparse updates, многомасштабные задержки credit, онлайн residual-модель мира, replay debt и защиту уже значимых связей.

Путь:

`context → task shift → context novelty/match → availability/selectivity → sparse plasticity gate → multi-horizon delay policy → residual world model → counterfactual/replay pressure → synaptic update → consolidation`

## Что реализовано

1. Context prototype и novelty/match для 16-мерного внутреннего контекста.
2. Per-neuron availability/selectivity/consolidation/importance.
3. Sparse update gate: часть слабых/защищённых связей не обновляется на каждом событии.
4. Adaptive plasticity multiplier вместо фиксированного learning-rate.
5. Онлайн residual-модель по действиям с confidence/variance.
6. Adaptive delay policy для восьми горизонтов 1/2/4/8/16/32/64/128.
7. Counterfactual/replay pressure участвует в регуляции пластичности.
8. Интеграция в microTick и full afterOutcome.
9. Persistence/restart через state schema 21.
10. Отдельный абляционный тест P2720.

## Научные основания

- Barry, Gerstner, Bellec, *Context selectivity with dynamic availability enables lifelong continual learning*, Neural Networks (2025/2026): контекстная селективность и локальная availability как метапластичность.
- Wang et al., *Model-agnostic linear-memory online learning in spiking neural networks*, Nature Communications (2026): линейная память eligibility-trace online learning.
- Liu et al., *Continual Reinforcement Learning by Planning with Online World Models*, ICML 2025: online world model + planning как подход к continual RL без обычного forgetting механизма.
- Friston et al., *Active inference and artificial reasoning*, Nature Communications (2026): expected information gain и informative action selection.
- Ji et al., *Wake the Sleeping Weights*, CVPR Findings 2026: sparse activation of previously inactive parameters для continual test-time adaptation.
- Three-factor delay learning rules for SNNs, Frontiers in Neuroscience (2026): joint online learning weights и temporal delays.

## Результат первого теста

`P2720_ADAPTIVE_LIFELONG=PASS`

- outcomes=72
- contextNovelty=0.0164
- contextMatch=0.9817
- sparseFraction=0.2017
- protectedFraction=0.2692
- delayConfidence=0.9763
- modelConfidence=0.7852
- experimental trajectory difference=9.3490
- restartOutcomes=72

Это подтверждает работу механизма и отличие experimental path от control, но не доказывает универсальное превосходство по continual learning. Для этого нужны matched-control батареи, A→B→A, interleaving, noisy labels, sparse reward и длительный soak.

## План следующего прохода

- multi-context interference matrix;
- task-boundary detection без oracle labels;
- online world-model planning на несколько шагов;
- sparse structural plasticity;
- selective replay/coreset policy;
- 500/1000-cycle mobile endurance;
- thermal/heap adaptive controller;
- counterfactual credit ablations;
- independent promotion gate.
