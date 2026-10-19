# V100 — Temporal Credit / Eligibility Substrate

## Цель
Реализовать реальный online temporal credit assignment в существующем parameter-free fast synapse без создания второго memory owner и без изменения default learning path.

## Реализация
- `single`: сохраняет V99 one-trace behavior;
- `immediate`: использует только текущую активность, без stale eligibility;
- `dual`: short + long traces;
- `adaptive`: возраст последнего значимого presynaptic signal управляет short/long mixture.

## Research alignment
Использованы как reference: официальный e-prop code и numerical verification, Apache-2.0 PyTorch e-prop implementation, BrainTrace (Apache-2.0), а также свежие работы 2026 года по temporal credit. Это собственная dense-RNN адаптация, не копирование SNN implementation.

## Qualification
5 seeds × delays 2/6/16/32/64, одинаковый budget.

Средняя relative MSE:
- single: **0.8305**
- dual: **0.8596**
- adaptive: **0.7858**

Adaptive лучше двух fixed baselines на этом held-out delay set. Immediate не обучает delayed association (ошибка 1.0), что ожидаемо для этой задачи.

## Статус
**CANDIDATE / NOT PROMOTED**

Причина: benchmark доказывает локальную causal utility, но не заменяет long-horizon full-NeuroCore qualification. Promotion требует проверки на полном runtime и continual-learning streams.

## Upstream references
- https://github.com/IGITUGraz/eligibility_propagation
- https://github.com/ChFrenkel/eprop-PyTorch
- https://github.com/chaobrain/braintrace
- https://arxiv.org/abs/2603.28750
- https://arxiv.org/abs/2602.18131
