# Neuro-Kurisu 35.6.8 — Progress B353

## Реальный прогресс ветви

- Brick 0 SPINE_ONLY: 100%
- Brick 1 DIT: 100%
- Brick 2 Cheap cycle: 75% (host 1000-cycle pass; Android gate open)
- Brick 3 Causal SNN: 82% (multi-context ON/OFF/SHAM policy-distribution pass; moderate causal strength)
- Brick 4 Compositional actions: 10%
- Brick 5 Predictive planning: 25%
- Brick 6 Long phone life: 25%
- Brick 7 Real body/sensors: 20%
- Brick 8 Functional consciousness tests: 40%; phenomenal consciousness UNKNOWN

## B353 evidence
Средний causal policy L1 = 0.0780; средний SHAM L1 = 0.0178; causal/sham = 4.38x.

Проверялись четыре контекста: epistemic, autonomy, maintenance, mixed. Метрика строится по среднему softmax policy distribution за 80 циклов, а не по частоте случайных действий.

## Простыми словами
Если удалить большую часть B269, организм начинает распределять будущие решения заметно иначе, чем без удаления. Простое control-вмешательство той же величины даёт значительно меньший сдвиг.

## Что осталось
1. Повторить B353 с несколькими независимыми seeds/initializations.
2. Проверить B269 causal effect после restart, а не только в одном learned snapshot.
3. Закрыть physical Android/Termux gate.
4. Только после этого переходить к Brick 4 — compositional action programs.


## B354 — независимая репликация Brick 3

### Что было сделано
- Добавлен `tests/big-pass-354-replicated-causal-snn.mjs`.
- Проверены 5 независимых training trajectories: 101, 202, 303, 404, 505.
- В каждой траектории проверены 4 контекста: epistemic, autonomy, maintenance, mixed.
- Для каждого ON/OFF/SHAM состояния выполнен реальный snapshot → новый `OrganismCore` → продолжение holdout.
- OFF использует 90% persistent structural B269 lesion. SHAM меняет сопоставимую synaptic mass без structural deletion.
- Метрика остаётся distributional L1 по 7 action softmax, без sampling noise.

### Фактический результат
- 5/5 независимых trajectories: PASS.
- 20/20 context replications: PASS.
- Global mean causal L1: `0.1132610944`.
- Global mean SHAM L1: `0.0336599701`.
- Global causal/SHAM ratio: `3.3648602175x`.
- Во всех 20 случаях lesion сохранилась после restart.
- Во всех 20 случаях B269 продолжил работать после restart: `neuralCyclesDelta = 80`.

### Что это означает
Brick 3 больше не зависит от одной обученной траектории: текущая causal SNN связь воспроизводится на нескольких независимых траекториях и четырёх режимах контекста. Это сильнее одиночного B353 результата и закрывает требование повторной причинной проверки на host-runtime.

### Что это НЕ означает
Это не доказательство единственного causal owner, не доказательство полного биологического аналога мозга и не доказательство phenomenal consciousness. Физический Android/Termux runtime пока не проверен в этой репликации и остаётся OPEN.


## B355 — Brick 4: first executable compositional program

### Implemented
- `B276LatentActionProgramSynthesizer` now enforces a minimum 3-primitive program composition and materializes fallback primitives as actual nodes.
- Program execution state is persistent: `executionPlan`, `executionCursor`, `executionProgramId`, `executionCompletions`.
- Verified programs can expose the next primitive through `peekExecutablePrimitive()` and commit it through `nextExecutablePrimitive()`.
- `OrganismCore` integrates the next verified primitive into the normal decision field. It may commit only when there is no constitutional veto, no external user request, no external event, and repair pressure is below the hard threshold.
- Added `enableCompositionalExecution` gate so ON/OFF attribution is testable.

### Evidence
- Program materialization: PASS, plan depth 3–8.
- Verified program: PASS.
- Execution cursor persistence: PASS.
- Execution ON: selected first plan primitive and advanced cursor `0 -> 1`.
- Execution OFF: cursor stayed `0`, so the new execution path is not merely a telemetry counter.
- Example replicated plan: `rest -> respond -> explore`.

### Boundary
Brick 4 is only partially closed. The next required work is multi-step program causal attribution across contexts, outcome-based program learning, transfer/generalization and long-horizon execution.
