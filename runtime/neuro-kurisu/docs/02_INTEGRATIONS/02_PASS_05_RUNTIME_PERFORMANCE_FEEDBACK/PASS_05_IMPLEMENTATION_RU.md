# PASS 05 — Runtime Performance Feedback / Mobile Endurance Infrastructure

Дата: 2026-09-26

## Цель

Замкнуть фактическую стоимость когнитивного runtime-цикла обратно в ресурсную экономику и телефонный scheduler, не меняя когнитивную семантику решений.

В PASS 04 ограничения телефона в основном поступали из sensor telemetry. В PASS 05 добавлена ещё одна реальная обратная связь: сколько цикл действительно занял CPU/wall-time и сколько памяти занял процесс.

## Реальная реализация

### 1. `RuntimePerformanceGovernor`

Новый `src/organism/system/RuntimePerformanceGovernor.ts`:

- собирает wall-time и CPU-time завершённых циклов;
- ведёт EMA и rolling p95 latency;
- фиксирует peak heap/RSS;
- выводит bounded `performancePressure01`, `memoryPressure01`, `cpuPressure01`;
- вычисляет budget/maintenance/scheduler multiplier;
- сохраняет состояние и переносит его через restart.

Состояние ограничено по размеру: rolling latency window содержит максимум 64 значения.

### 2. Runtime → Cognitive Resource Economy

`OrganismRuntime` теперь передаёт фактический `performancePressure01` в `CognitiveResourceEconomy` следующего цикла.

При росте реальной runtime-нагрузки уменьшается общий execution envelope и растёт scarcity. Это влияет на уже существующие budget gates, а не создаёт отдельный fake scheduler.

### 3. Runtime → Phone scheduler

Телефонный scheduler получает не только последний raw step time, но и устойчивую `effectiveLastStepMs`, основанную на max(last, p95).

Это предотвращает ситуацию, когда несколько быстрых циклов маскируют недавно возникший устойчивый slowdown.

### 4. Maintenance feedback

При высоком runtime pressure mobile consolidation cadence автоматически растягивается. Emergency checkpoints и explicit sleep consolidation остаются приоритетными и не отключаются governor-ом.

### 5. Persistence

Добавлено:

- `OrganismCore.system.runtimePerformance`;
- StateMigrations passthrough;
- runtime restore;
- executable restart verification.

Существующие архивные состояния без этого поля корректно получают отсутствие runtime-performance history.

## Executable verification

`tests/p2864-runtime-performance-governor.mjs`

PASS:

- 1000 synthetic performance samples остаются finite/bounded;
- high-performance-pressure снижает resource budget;
- реальный `OrganismRuntime` пишет performance samples;
- performance state восстанавливается после restart;
- cumulative wall-time не уменьшается после восстановления.

Последний контрольный результат:

`P2864_RUNTIME_PERFORMANCE=PASS samples=5 p95Ms=617 pressure=0.053 budgetNominal=0.802 budgetPressured=0.655`

## Связь с PASS 04

PASS 04 остаётся полностью действующим:

- adaptive replay;
- embodied consequence learning;
- bounded multi-step world replay;
- recurrent protection;
- identity/world/neural gated goal consolidation;
- compact 1000-cycle endurance.

P2863 продолжает PASS. В контрольном runtime-прогоне multi-step trajectory counter не вырос, потому что runtime confidence/evidence gate не достиг условий безопасного promotion. Это считается сохранённым защитным поведением, а не доказательством того, что runtime уже постоянно использует imagined multi-step trajectories.

## Ограничение

PASS 05 не объявляет native SIMD/NEON/NNAPI acceleration реализованной. Добавлена только реальная adaptive runtime/performance infrastructure. Нативные kernels требуют отдельного backend implementation и benchmark equivalence gate.

Также ещё не объявляется полный 100/500/1000-cycle `OrganismRuntime` endurance PASS: текущий executable runtime gate короткий, а длинные 1000-cycle проверки остаются на компактных stateful-модулях.
