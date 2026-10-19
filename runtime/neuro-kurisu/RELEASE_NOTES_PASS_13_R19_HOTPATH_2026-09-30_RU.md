# PASS 13 — R19 Hot-Path / Runtime Residency

Дата: 2026-09-30
Проект: Neuro-Kurisu 35.40.0 / R26

## Цель

Закрыть ранее выявленную проблему long-horizon R19: рост RSS и деградация `observe()` на длинной серии, при этом не ослабляя 256-cycle/restart gate.

## Реальные изменения

### 1. Убран лишний deep-clone из B297 facade hot path

`OrganismCore` больше не вызывает полный `CognitiveSubsystemFacade.snapshot()` на каждом observe. В hot path используются компактные канонические числовые поля; полный facade snapshot остаётся на checkpoint/public boundary.

### 2. Убраны повторные candidate-level snapshots

Вместо snapshot на каждого action candidate подготовлены один раз на decision:

- recovery self-model;
- causal developmental snapshot;
- adaptive neural compute-governor diagnostics;
- autobiographical identity diagnostics.

Это сохраняет содержимое оценки и убирает повторное глубокое копирование.

### 3. Добавлен explicit non-clone режим для memory retrieval

`SemanticMemoryGraph`, `MemoryOS2`, `MultiTimescaleMemory` и `MemoryFabric` поддерживают live-read путь без deep clone там, где downstream использует данные только для чтения.

Durable/public boundaries по-прежнему клонируют данные.

### 4. Убран per-cycle NeuralExperience state mirroring

Состояние `NeuralExperienceBranch` теперь синхронизируется с его подкомпонентами на durable/public `snapshot()` boundary. Hot-path consumer'ы используют lightweight metrics вместо чтения stale mirrored snapshots.

### 5. Убран per-cycle SelfProject / SelfPrediction clone

Добавлены read-only варианты `activeProjects`, `activeDevelopmentCycle` и `SelfPredictionBenchmark.seed` для локальных decision paths.

### 6. Lightweight metrics вместо snapshot для P26

`P26TrueLearningEngine.metrics()` позволяет получить bounded metrics projection без deep snapshot всей learning state.

### 7. Уменьшено collateral copying в recurrent/world kernels

Там, где структуры создаются заново и содержат только scalar/plain fields, глубокие `structuredClone` заменены на shallow projections/новые scalar objects.

## Измеренный результат

Сравнивался тот же `npm run test:p2895:long-horizon`.

### До PASS 13

- 256 cycles: логически проходили после предыдущих исправлений, но предыдущий измерительный run показывал около 33.23 s wall time.
- max RSS: 517,576 kB (~505.4 MiB).
- first cycle: 105.99 ms.
- last cycle: 129.75 ms.

### После PASS 13

- 256 cycles: **PASS**.
- restart: **tick 257**.
- wall time: **23.57 s**.
- max RSS: **502,284 kB (~490.5 MiB)**.
- first cycle: **68.45 ms**.
- last cycle: **95.40 ms**.
- slowdown ratio: **1.394x**.

Это примерно **−29% wall time** и **−15.3 MB (~−3.0%) max RSS** относительно предыдущего измерительного run на той же проверке.

### Structured-clone profiling

Диагностический run первых 64 cycles показал:

- до hot-path прохода: ~73,295 `structuredClone` calls;
- после PASS 13 изменений: ~40,938 calls.

Снижение: примерно **44%**.

Это diagnostic evidence, а не отдельный correctness gate.

## Verification

- Typecheck — PASS.
- R26 release core — PASS, 8/8.
- R19 direct 256-cycle/restart — PASS.
- R19 regression tests P2887–P2891 — PASS.
- P2842 calibration — PASS.
- P2855 contextual policy — PASS.
- Core ownership — PASS, 5 direct constructors.
- Architecture — PASS, 1775 source files / 552 canonical files / 0 cycles.
- Hygiene — PASS, 3873 checked files / 0 warnings / 0 errors.
- Forensics — PASS, duplicateContent=0 / duplicateNames=0 / staleMarkers=0.
- Syntax — PASS.
- Integrity — PASS.
- Release source — PASS.
- Neural substrate — PASS.
- Observation-stage migration — PASS.
- Organism smoke — PASS.

## Orchestration note

`npm run release:r19:core` не был объявлен PASS: агрегатор упёрся в общий execution timeout после запуска long-horizon этапа. Сам `test:p2895:long-horizon` был затем/ранее выполнен напрямую и прошёл 256 cycles + restart, а остальные R19 gates были выполнены отдельно и прошли.

Это ограничение orchestration, а не failure отдельного R19 test.

## Следующий проход

Следующая задача: снизить residency/runtime overhead после 256 cycles, отделив short-lived working-state от durable projections, с особым вниманием к:

1. EventLog retention/recent views;
2. CausalLifeGraph node upserts;
3. ParametricPolicy/AdaptiveMemory snapshots;
4. first-cycle baseline snapshots, которые остаются в процессе дольше необходимого;
5. Android/Termux-specific RSS gate на реальном устройстве.

После этого — продолжить extraction `OrganismCore.observe()` в `Perception/Reality Stage` без изменения evidence ordering.

## Research alignment

Современные xLSTM/mLSTM работы используют разделение между быстрым recurrent state и специализированными kernels/backend'ами; это поддерживает нынешнее разделение Neuro-Kurisu на cognitive persistence и pluggable neural substrate, а не идею превращения mLSTM в единственную canonical memory. citeturn406932search0turn406932academia26

Для runtime диагностики важно отдельно отслеживать `heapUsed`, `external` и `rss`: Node.js прямо отмечает, что RSS включает native/C++ и JS объекты и может расти даже при стабильном V8 heap из-за allocator fragmentation. Поэтому следующий mobile pass должен измерять эти компоненты отдельно, а не использовать RSS как единственный proxy. citeturn406932search1

Долговременная neural memory остаётся отдельным исследовательским направлением: Titans, ATLAS и TNT исследуют test-time memorization и альтернативы чистому fixed-state recurrence. Эти идеи полезны как будущие substrate candidates, но не заменяют provenance/identity/memory ownership Neuro-Kurisu. citeturn406932academia24turn406932academia27turn406932academia25
