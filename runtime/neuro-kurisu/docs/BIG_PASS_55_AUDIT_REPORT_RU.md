# BIG PASS 55 — Cognitive Pressure Field + Passive World Learning

Версия релиза: **34.26.0**.

## Цель
Объединить существующие CognitiveField, PredictionDebt, GroundedWorldState и CognitiveExecutionPlanner без создания ещё одного конкурирующего persistent state; дополнительно дать P27 возможность учиться на пассивных последовательностях наблюдений.

## Реальные изменения
- Добавлен `CognitivePressureField`: производный агрегатор давления по доменам и действиям.
- `CognitiveExecutionPlanner` принимает pressure-сигнал и использует его для распределения metabolism/budget.
- `OrganismCore` строит pressure из уже существующих состояний: CognitiveField + PredictionDebt + GroundedWorldState + body/resources.
- Добавлен минимальный action bias к arbitration; bias ограничен и не заменяет governance/P64.
- P27 получил `observePassiveTransition(before, after)`: это обучение наблюдаемого перехода без ложного приписывания изменения действию агента.
- Добавлены regression tests.

## Почему это лучше
Ранее pressure, prediction debt и uncertainty существовали как частично независимые сигналы. Теперь они преобразуются в один routing signal, который одинаково используется planner и action arbitration. Это уменьшает расхождение между "что важно" и "на что выделяются вычисления".

## Чего этот проход не утверждает
- Passive P27 transition learning не является полноценным causal model.
- Cognitive pressure не является эмоцией или субъективным переживанием.
- Pressure action bias не является самостоятельной волей; он лишь слабый routing/modulation signal.

## Mobile
Новая система специально не создаёт долгоживущий отдельный pressure journal. Pressure вычисляется из уже имеющихся состояний, поэтому не должен создавать ещё один большой persistent graph.
