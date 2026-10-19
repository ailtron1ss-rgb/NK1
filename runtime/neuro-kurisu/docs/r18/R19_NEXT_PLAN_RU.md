# Neuro-Kurisu R19 — следующий проход

## Приоритет 1 — provenance-aware conflict arbitration

Добавить explicit evidence authority/recency weighting поверх текущего implicit-conflict detector. Цель — различать:
- новое пользовательское наблюдение;
- внешний verified evidence;
- internal inference;
- simulation/counterfactual state.

## Приоритет 2 — operation-level semantic coverage

Построить critical-operation graph для 200–400 наиболее значимых функций и проверять не только вызов, но:
input → state transition → persisted effect → downstream behavioral effect → replay.

## Приоритет 3 — unified world model

Связать current predictive world state, causal calibration, memory evidence and action consequence в один bounded transition contract.

## Приоритет 4 — continual learning safety

Добавить anti-collapse constraints и prior-preserving regularization для learned retention weights, затем провести 1k/10k update stress tests.

## Приоритет 5 — neural substrate experiment

Отдельный lightweight recurrent/SSM experiment без изменения canonical runtime. Условия принятия в core: measurable ablation gain, bounded RAM/latency, persistence and restart continuity.

## Приоритет 6 — Android endurance

Реальный Termux run: 1000+ cycles, forced kill/restart, low-memory, thermal, storage pressure, idle/awake transitions.

## R19 release criterion

Новый механизм принимается только если он:
- имеет отдельного canonical owner;
- влияет на реальный runtime path;
- имеет ablation или counterfactual proof;
- сохраняется через restart;
- не нарушает mobile semantic equivalence.
