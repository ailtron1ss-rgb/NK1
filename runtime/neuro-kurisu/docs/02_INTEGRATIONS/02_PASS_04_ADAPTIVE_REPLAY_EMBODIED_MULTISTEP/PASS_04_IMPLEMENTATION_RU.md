# PASS 04 — Adaptive Replay ↔ Embodiment ↔ Multi-step World Replay ↔ Goal Consolidation

Дата: 2026-09-26
База: PASS 03 `35.30.0-R16`

## Цель

Продолжить причинный контур без создания нового policy-authority и без декоративных адаптеров:

`uncertainty/error/novelty → replay policy → learned world model → embodied consequence → multi-step replay → recurrent protection → value/goal consolidation`.

## Реальные изменения

### 1. P2724 — adaptive replay policy

`P2724AutonomousContinualFabric` больше не держит replay mixture как почти статическую конфигурацию.
После outcome четыре replay-arm (`priority`, `context`, `novelty`, `stochastic`) получают bounded online adaptation от:

- prediction error;
- novelty;
- uncertainty;
- verification;
- context shift;
- forgetting pressure;
- available resource budget.

Добавлен `replayAdaptation01`. Нормализация смеси сохраняется, capacity replay buffer не меняется.

### 2. Neural semantic consolidation → recurrent parameter protection

`NeuralExperienceBranch` теперь преобразует confidence/pressure semantic consolidation и identity continuity в `semanticRecurrentProtection01`.

Этот gate применяется к реальному recurrent/synaptic update rate, а не только к slow-memory write. Таким образом semantic consolidation может стабилизировать уже усвоенные recurrent связи, не замораживая sensory/action plasticity полностью.

### 3. P2750 — embodied closed-loop consequence

`P2750UnifiedCausalWorldLoop` получил persistent embodied-grounding state:

- `embodiedGrounding01`;
- `embodiedPredictionError01`;
- `groundedConsequence01`.

После реального `EmbodiedCausalWorldBridge.afterOutcome()` эти сигналы входят обратно в world loop. Они влияют на world confidence и replay utility, поэтому sensorimotor disagreement больше не остаётся изолированной диагностикой.

### 4. P2750 — multi-step model replay

Добавлен bounded `syntheticTrajectories(limit, depth)` с максимумом 2 trajectories × 3 steps.

Каждый step хранит:

- action;
- latent before/after;
- predicted reward;
- model confidence;
- replay priority.

`NeuralExperienceBranch` использует trajectory replay для bounded action-readout updates. При невозможности безопасной multi-step генерации сохраняется существующий one-step fallback.

### 5. P67 — long-timescale goal consolidation gate

`P67AutonomousGoalGenesis.recalibrateActiveGoals()` теперь получает три confidence-сигнала:

- identity stability;
- learned world confidence;
- neural confidence.

Сила долгосрочной коррекции importance/urgency теперь пропорциональна bounded consolidation gate. Нестабильный identity/world context не может быстро переписать накопленную goal structure.

## Persistence

Новые P2724/P2750 поля входят в snapshot состояния существующих модулей и восстанавливаются через их canonical `restore()`; отдельный новый authority/state store не добавлялся.

## Executable validation

- `typecheck-runtime`: PASS
- `test:p2863`: PASS
- `P2750 interference matrix`: PASS
- `P2750 planner fallback`: PASS
- `test:p2862`: PASS
- `test:p2862:persistence`: PASS
- `test:p2862:dream`: PASS
- `p2852-core-integration`: PASS
- `p2853-core-integration`: PASS
- `p2854-core-integration`: PASS
- `p2850-core-integration`: PASS
- `test:replay`: PASS
- `test:smoke`: PASS
- `test:memory`: PASS
- `test:restart`: PASS

### Endurance

Отдельный компактный endurance-контур прогоняет P2724 и P2750 по 1000 циклам и проверяет bounded state/capacity/finite metrics.

Полный OrganismRuntime endurance пока намеренно не объявлен пройденным: полный 96-cycle mobile runtime gate оказался слишком тяжёлым для текущего batch budget, а короткий runtime gate на 24 циклах проходит. Это оставлено как отдельный performance task, а не скрыто увеличением timeout.

## Статус интеграции

Текущий официальный integration-backlog progress после PASS 04: **74.47%**.

Это процент закрытия заранее определённого integration backlog, а не оценка сознания, AGI или общей готовности личности.
