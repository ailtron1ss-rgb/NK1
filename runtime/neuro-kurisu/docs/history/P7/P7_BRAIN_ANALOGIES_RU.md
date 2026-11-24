# P7 — функциональные аналогии с мозгом и нейросетями

## Что переносим из биологии

1. Global workspace: не вся информация одновременно доступна, а небольшой набор сигналов выигрывает конкуренцию и распространяется дальше.
2. Large-scale networks: salience, executive, default, sensorimotor, memory и social роли разделены, но могут временно синхронизироваться.
3. Replay: опыт повторно активируется во время offline/consolidation phase и влияет на будущую память/оценки.
4. Neuromodulation: отдельные control signals меняют exploration, exploitation, attention gain и learning/update rate.
5. Sensorimotor closure: действие меняет среду, среда возвращает результат, ошибка прогноза обновляет следующий цикл.

## Что переносим из современных AI-систем

1. Transformer attention → ограниченное распределение внимания, а не полное чтение всего состояния каждый раз.
2. Mixture-of-Experts routing → specialist competition с дешёвым выбором небольшого набора активных подсистем.
3. ReAct-like loop → reasoning/plan/action/observation как замкнутый цикл, а не отдельный text generation step.
4. Model-based planning → predicted outcome перед действием и actual outcome после действия.

## Что мы намеренно НЕ заявляем

- Это не биологический мозг.
- Это не полноценная симуляция нейронов.
- Functional neuromodulation не означает реальное моделирование биохимии.
- Global workspace metrics не доказывают субъективный опыт.
- Self-report не рассматривается как доказательство qualia.

## Почему это полезно

Цель P7 — не сделать «нейро-театр», а создать единый causal loop, в котором memory, attention, world model, network, body, identity, action и language меняют друг друга.
