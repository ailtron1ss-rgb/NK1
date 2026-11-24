# PASS 12 — Core Observation Consolidation + Durable Neural Backend

Дата: 2026-09-30
Проект: Neuro-Kurisu 35.40.0 / R26

## Цель

Сократить связность `OrganismCore` без изменения canonical behaviour, вынести первый крупный участок `observe()`, а состояние нового neural-substrate backend сделать реально durable.

## Реальные изменения

### 1. Observation planning вынесен из OrganismCore

Добавлен:

`src/organism/core/ObservationPlanningStage.ts`

В него вынесены:

- нормализация world observation;
- CognitiveFrame;
- resource allocation;
- cognitive resource economy;
- cognitive pressure field;
- cognitive spine scheduling;
- cognitive execution plan;
- memory/perception execution gating.

`OrganismCore.observe()` теперь остаётся orchestration-слоем и получает результаты одного planning-stage вместо повторного знания обо всех planning primitives.

### 2. Observation input assembly вынесен

Добавлен:

`src/organism/core/ObservationInputAssembler.ts`

Вынесены canonical builders для:

- P35 body input;
- P37 embodied-sensorium input;
- perception body/telemetry input.

Это уменьшает inline object duplication и удерживает форматы P35/P37 в одном месте.

### 3. Side-effect ordering сохранён явно

После выноса planning обратно сохранены в `OrganismCore` в canonical порядке:

`domain closure → cognitive dependency resolution → revision-token touches → planning outputs`

Это важно: planning extraction не должен превращаться в скрытую потерю evidence/persistence semantics.

### 4. Neural substrate persistence усилена

Добавлено durable состояние:

`system.neuralSubstrateBackend`

Сохраняется полный backend snapshot:

- canonical neural substrate;
- mLSTM shadow;
- backend mode;
- последняя shadow comparison.

`canonicalNeuralSubstrate` сохранён как compatibility projection.

### 5. PersistenceProjectionCoordinator

Добавлен отдельный projection path для полного neural backend snapshot.

Таким образом альтернативный substrate не остаётся только RAM-state.

### 6. Тесты

Добавлены:

- `tests/r26-observation-planning-stage.mjs`
- `test:r26:observation-stage`
- `test:r26:neural-substrate`

R26 neural backend test теперь проверяет не только canonical restore, но и full backend snapshot с восстановлением mLSTM shadow.

### 7. R19 long-horizon test

`tests/p2895-r19-long-horizon.mjs` обновлён так, чтобы после durable flush использовать реально сохранённое состояние `MemoryStateStore`, а не второй дорогой публичный `core.snapshot()`.

Это лучше соответствует цели теста: checkpoint → restore → continuation.

## Измеренный результат

До прохода:

- `OrganismCore.ts` ≈ 10.2k строк;
- `observe()` был монолитным orchestration+planning+input-construction блоком;
- full neural backend не имел отдельного durable projection.

После:

- `OrganismCore.ts`: 10,161 строк;
- `observe()`: ≈ 3,679 строк;
- planning-stage: 127 строк отдельного модуля;
- input assembly: 61 строк отдельного модуля;
- Core ownership: `PASS`, 5 direct constructors;
- architecture: `PASS`, 1,771 source files / 552 canonical files / 0 cycles;
- hygiene: `PASS`, 3,867 checked files / 0 warnings / 0 errors;
- integrity: `PASS`;
- release contract: `PASS`;
- release source: `PASS`;
- R26 neural backend: `PASS`;
- observation planning stage: `PASS`;
- durable neural backend fields after flush: `PASS`.

## Важное ограничение

R26 matched ablation по-прежнему честно показывает:

`lowRankImprovement01 = -0.0000177`

`lowRankCanonicalPromotion = false`

Поэтому low-rank не promoted в canonical path этим проходом.

## Следующий проход

Основной следующий structural target:

`OrganismCore.observe() → Perception/Reality Stage → Learning/Agency Stage → Finalization`

сначала извлечь perception/reality stage без изменения evidence ordering.

Параллельно нужен отдельный mobile-memory pass по residency/retention budgets для средних Android устройств.

## Verification limitation discovered during this pass

`p2895-r19-long-horizon` was intentionally **not** marked PASS. The 256-cycle live-process run still exceeds the current execution budget after reaching the 240-cycle region. A diagnostic run shows RSS rising toward ~485 MB while serialized durable state is only ~6 MB, which points to retained runtime/cache allocations rather than simply persisted state size. This becomes the next performance hot-path target; the gate itself was not weakened. `test:restart` likewise exceeded the available execution window and is not claimed as PASS.

This is a real unresolved runtime-performance issue, not a documentation-only exception.
