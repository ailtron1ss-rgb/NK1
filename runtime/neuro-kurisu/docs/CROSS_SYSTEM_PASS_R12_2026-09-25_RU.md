# Neuro-Kurisu — Cross-System / Upstream Integration Pass R12

Дата: 2026-09-25
Release: 35.26.0 / P2855
State schema: 219

## Цель

R12 направлен на прямую интеграцию проверенных внешних инженерных идей в существующий runtime без добавления новых зависимостей и без декоративных механизмов.

Главные направления:

1. continual learning / replay;
2. prioritized replay и importance correction;
3. balanced exemplar memory;
4. robust reward/teaching signal normalization;
5. uncertainty-guided metaplasticity;
6. mobile allocation pressure;
7. source-truth / forensic cleanup;
8. backward-compatible persistence;
9. критические behavioural regression tests.

## Прямые upstream-интеграции

### Avalanche — MIT
Источник: https://github.com/ContinualAI/avalanche

Интегрирован standalone TypeScript вариант reservoir/balanced exemplar подхода в `UpstreamReplayPrimitives.ts` и затем подключён к:

- B365 replay memory;
- P30 transfer exemplar memory.

Сделан дополнительный hard-cap при числе групп больше capacity, чтобы баланс не мог превысить мобильный лимит памяти.

### Tianshou — MIT
Источник: https://github.com/thu-ml/tianshou

По структуре `PrioritizedReplayBuffer` встроен standalone mobile-вариант:

- priority^alpha;
- importance sampling weight;
- адаптивный beta;
- replay stream statistics.

Вместо SegmentTree используется bounded linear sampler, потому что текущая canonical replay capacity организма равна 128; это уменьшает зависимость и overhead на телефоне.

### DreamerV3 — MIT
Источник: https://github.com/danijar/dreamerv3

Перенесены как самостоятельные компоненты:

- `symlog` / `symexp`;
- robust percentile normalization.

Они подключены к teaching/reward path там, где сигнал может иметь большой динамический диапазон.

### MESU / uncertainty-guided continual learning
Исследовательская основа: Bonnet et al., Nature Communications, 2025.

Не копируется чужой implementation. Создан самостоятельный uncertainty-guided metaplastic consolidation layer:

- uncertainty-dependent learning rate;
- weight anchor;
- learned importance;
- consolidation correction.

### Norse / BindsNET
Источники:
- https://github.com/norse/norse
- https://github.com/BindsNET/bindsnet

Использованы как исследовательские reference implementations для SNN/stateful/eligibility-trace подходов, но их исходники напрямую не vendored: Norse распространяется под LGPL-3.0, BindsNET — под AGPL-3.0. Это осознанная license boundary.

## Ключевые изменения

### B365
- state schema 12;
- balanced reservoir capacity 128;
- prioritized replay;
- adaptive importance beta;
- replay state полностью восстанавливается после restart;
- materialization `values()/groupStates()` выполняется только после фактического insertion/replacement;
- diagnostics теперь возвращает canonical `state.version`.

### P30
- transfer memory больше не является простой FIFO/"последние 96";
- используется balanced reservoir по task/action groups;
- capacity 96 остаётся жёсткой;
- restore и post-restart continuation проверяются regression-тестом.

### NeuromodulatoryPlasticitySubstrate
- state schema 2 с backward-compatible restore;
- uncertainty matrix для output/recurrent weights;
- weight anchors + importance;
- uncertainty-scaled plasticity;
- metaplastic consolidation;
- robust symlog teaching signal.

### Mobile runtime
Обнаружен и устранён allocation hotspot: replay/state groups материализовались каждый cycle даже без изменения reservoir.

## Измеримые результаты

### Mobile 256 MB benchmark
30 autonomous cycles:

- elapsed: 15.43 s;
- p50: 483.3 ms;
- p95: 695.7 ms;
- max cycle: 885.2 ms;
- max V8 heap: 127.4 MB;
- max RSS: 307.7 MB.

Это не утверждение, что весь организм помещается в 256 MB RAM: ограничение применено к V8 old-space, RSS заметно выше.

### P2855
Contextual policy:

- holdout accuracy: 1.0;
- 1200 updates;
- persisted=true.

Integration:

- 84 cycles;
- 84 policy updates;
- persisted=true.

Ablation:

- policy on: 0.2667;
- policy off: 0.1667;
- absolute gain: **+0.10**.

### P30
- stream: 150;
- exemplars: 96;
- groups: 96;
- hard capacity maintained.

### Neuromodulation
- uncertainty-guided consolidation test PASS;
- anchor drift remained very small;
- metaplasticity remained active.

### World / previous R10 improvements retained
Local controlled world hot-path benchmark from R10 remained part of the release lineage; R12 did not revert that optimization.

## Persistence / compatibility

- `B365` v11 snapshot compatibility: PASS;
- `NeuromodulatoryPlasticitySubstrate` v1 snapshot compatibility: PASS;
- `p2841` and `p2842` migration tests use current canonical release metadata;
- restart persistence: PASS;
- server smoke: PASS;
- organism smoke: PASS;
- archive manifest: PASS, 3962 files, 0 missing, 0 hash mismatches, 0 extras.

## Quality gates

PASS:

- typecheck;
- architecture: cycles=0, missing=0, legacyLeakage=0;
- core ownership: 5 direct constructors;
- hygiene: 0 errors / 0 warnings;
- syntax;
- release contract;
- integrity;
- source-truth;
- forensics;
- upstream audit: 19 checks, 0 failures;
- restart persistence;
- server smoke;
- ordinary organism smoke;
- mobile256 smoke;
- P2855 contextual/integration/ablation;
- R12 upstream integration suite;
- P30 reservoir suite;
- neuromod consolidation suite.

`audit:all` itself may terminate on the long aggregate smoke launcher timeout even though the corresponding smoke test passes independently; this is an orchestration/runtime-duration limitation, not reported here as a green aggregate gate.

## Что осталось и не скрывается

1. Semantic coverage остаётся низким:
   - total functions: 5292;
   - VERIFIED: 34;
   - INTEGRATION_ONLY: 9;
   - UNVERIFIED: 4933.

   Поэтому следующий приоритет — не количество модулей, а доказательная проверка критических live paths.

2. Long-horizon mobile endurance 1000 cycles ещё не доказан.

3. RSS выше V8 old-space лимита; memory-native слой Android ещё требует дальнейшей оптимизации.

4. P2853 slow-memory transfer сохраняет интересный сигнал: forward transfer положительный, но replay independent-H gain в текущем benchmark отрицательный. Это хороший кандидат на отдельный ablation/research pass, а не причина скрывать результат.

## Следующий проход R13

1. поднять behavioural evidence для первых 100–200 наиболее важных runtime-функций;
2. проверить 250/500/1000 cycles с retained-heap, replay residency и recovery cadence;
3. исследовать отрицательный independent replay result P2853;
4. сравнить handcrafted world/policy components с learned dynamics/policy candidates;
5. усилить real embodied loop: observation → world model → policy → action → external verification → learning.
