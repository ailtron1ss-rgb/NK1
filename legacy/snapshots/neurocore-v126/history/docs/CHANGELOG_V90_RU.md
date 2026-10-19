# CHANGELOG V90 — Neurality Routed/Preconditioned Spine

Дата: 2026-09-25

## Что реально изменено

### 1. Новый current recurrent owner
`RoutedPreconditionedDeltaSpineV90` заменяет V82 selective-delta spine внутри current learning/runtime path. Источник долгосрочной памяти не дублируется: recurrent state остаётся transient state, canonical memory остаётся единственным long-term memory owner.

### 2. Независимые erase/write решения
Erase и write вычисляются отдельными channel-wise проекциями. Erase применяется как delta-rule correction к ключевой стороне state, write — как отдельный канал записи значения.

### 3. Sparse routed state editing
Добавлен input-dependent top-k router. При `rank=8, topk=3` физически изменяются только три выбранные строки recurrent state за шаг. Для обучения используется straight-through route: forward sparse, backward differentiable.

### 4. Онлайн диагональная preconditioning
Поддерживается EMA энергии key-каналов и ограниченный inverse-RMS preconditioner. Это компактная инженерная реализация идеи curvature-aware/online-regression conditioning, а не дословная реализация PGDN.

### 5. Диагностика opt-in
Полные `route`, `route_probs` и `preconditioner` не стекаются в каждый training step по умолчанию. Их можно включить для qualification через `collect_diagnostics=True`, что не раздувает основной forward-путь.

### 6. Устранён дубликат регистрации
Один recurrent module теперь зарегистрирован только по `engine.unified_spine_v80.*`; `NeuroCoreCurrent.spine` — только property. Это устраняет второй state_dict path на тот же объект.

### 7. Migration
Current checkpoint schema повышена до 2. При загрузке V89/старых current checkpoints старые spine tensors не подмешиваются в новую семантику state; остальные совместимые tensors и optimizer state продолжают мигрироваться.

## Qualification

Пять seeds × 240 steps на episodic key→value recall:

- cosine: 0.3871 → 0.4650, +20.1% relative;
- top-1: 0.1958 → 0.3255, +66.2% relative;
- train micro-time: 2.441 s → 3.275 s, +34.2%.

Это **наблюдаемое улучшение на конкретном qualification-задаче**, не универсальное доказательство превосходства.

## Research basis

- Gated DeltaNet-2: независимые channel-wise erase/write gates и channel-wise decay.
- Raven: input-dependent sparse routing по фиксированным memory slots.
- Preconditioned DeltaNet: online least-squares/test-time-regression framing и diagonal approximation of preconditioning.
- flash-linear-attention: актуальная reference implementation ecosystem для Delta/GDN/KDA/Raven/Mamba3/PGDN исследований.

External source code was studied rather than copied into the current trunk.
