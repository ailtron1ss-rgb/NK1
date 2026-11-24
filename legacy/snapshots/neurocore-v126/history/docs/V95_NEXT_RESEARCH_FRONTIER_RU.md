# V95 — следующий research frontier

## 1. Adaptive Linearity (AdaLin)

Исследовать neuron-level adaptive linearization: per-unit learnable linearity plus a gradient-flow-dependent gate. Это альтернативный путь сохранения plasticity без периодического reset.

Reference: Rohani et al., Lifelong Learning Agents 2026; code: https://github.com/RoozbehRazavi/AdaLin

## 2. Selective Weight Reinitialization

Исследовать переинициализацию отдельных наименее полезных весов вместо целых units. Работа Hernandez-Garcia et al. (Lifelong Learning Agents 2026) сообщает преимущество weight-level схем в малых сетях и в сетях с layer normalization.

Reference: https://proceedings.mlr.press/v330/hernandez-garcia26a.html

## 3. Qualification

Новые механизмы не добавляются в default current. Сначала paired 5-seed continual streams, late plasticity probe, forgetting, recovery, active-unit/weight coverage, latency и memory.
