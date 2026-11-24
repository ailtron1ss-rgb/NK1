# Neuro-Kurisu 34.10.0 — BIG PASS 41

Дата: 2026-09-05
State schema: **87** (не менялся; новые поля в persisted state не добавлялись)
Фаза: `Stage-2/performance-spine-autonomous-grounding`

## 1. Задача прохода

Этот проход продолжает первый полный аудит проекта. Цель — не добавлять новые P-модули, а сделать существующую cognitive spine дешевле на среднем телефоне и уменьшить накопление latency/heap.

Основная цепочка:

`observation → prediction → decision → project → evidence → learning`

Главный критерий: **оптимизация не должна удалять интеллектуальную функцию; она должна уменьшать повторную работу, частоту холодных контуров и allocations.**

## 2. Полная перепроверка первого аудита

Первый аудит содержал 20 крупных направлений. В текущем 34.10.0 cross-check сохранён в `docs/INITIAL_AUDIT_BASELINE_AND_PROGRESS_RU.md` и `docs/FIRST_AUDIT_FULL_CROSSWALK_BIG_PASS_41_RU.md`.

Текущий строгий статус:

- 7 направлений имеют полностью закрытый базовый кодовый слой;
- 12 остаются частично закрытыми и требуют внешнего/device/longitudinal validation или более глубокой архитектурной реализации;
- 1 направление (native Android host/lifecycle) остаётся фактически незакрытым.

Weighted implementation первого аудита: **≈74%**. Подробная crosswalk-карта: `docs/INITIAL_AUDIT_CROSSWALK_BIG_PASS_41_RU.md`. Это именно реализация исходных инженерных рекомендаций, а не «процент сознания».

## 3. Главный обнаруженный performance-риск

До этого прохода long-horizon 250-cycle benchmark периодически упирался в timeout. Профилирование 120 ticks показало:

- ранняя median latency порядка 15–20 ms;
- после ~70 ticks появляются скачки до >100–200 ms;
- heap периодически резко увеличивается, после чего GC даёт резкие провалы latency;
- в hot path есть повторные snapshot/predict вычисления, которые не меняются внутри одного tick.

Это делает основной риск не «недостаток вычислительной мощности», а **лишнюю повторяемую работу и allocations**.

## 4. BIG PASS 41 — что изменено

### 4.1. Per-tick model cache

В `OrganismCore` добавлен локальный cache `modelSignalsByAction`.

Один tick теперь повторно не рассчитывает для selected action:

- P10;
- P26;
- P27;
- P30;
- rollout signals.

Их результаты сохраняются на время текущего цикла и переиспользуются в reasoning trace.

### 4.2. Shared forecasts

Вынесены однократные вычисления:

- P24 body forecast;
- P26 recent-loss snapshot;
- social prediction error;
- P44 experience vector.

Это удаляет несколько повторов внутри 7 action candidates.

### 4.3. Adaptive perception cadence

При отсутствии text/vision/audio:

- perception не пересчитывается на каждом tick;
- refresh выполняется на cadence или при deep mode;
- внешний input всегда вызывает немедленный refresh.

Так сохраняется sensor/semantic cognition, но phone runtime не делает идентичный анализ спокойного окружения десятки раз подряд.

Короткий интеграционный test подтвердил, что при 40 ticks организм прошёл 40 ticks, а temporal perception обновилась только до tick 11, тогда как spine реально пропустил cold operations (`spineSavings≈0.600`). Финальный run этого теста: `firstMedian=11.94 ms`, `lastMedian=15.69 ms`, `ratio=1.313`.

### 4.4. Duplicate Evidence Bus snapshot

В `OrganismRuntime` удалён второй одинаковый `setRuntimeEvidence(snapshot())` в одном cycle.

### 4.5. Release patch/feature version

Версия повышена до **34.10.0**. State schema остаётся **87**, так как изменения не требуют нового persisted-schema contract.

## 5. Что НЕ изменялось

Не отключались:

- P30/P26/P27;
- P31–P82;
- Model Olympics;
- Shadow Organism;
- Evidence Bus;
- prediction ledger;
- autonomous project executor;
- identity/self-model;
- governance/safety.

Изменена только частота/повторяемость вычислений и reuse результатов внутри tick.

## 6. Фактические измерения

### Короткий performance spine gate

`BIG_PASS_41_PERFORMANCE_SPINE=PASS`

Последний прогон:

- ticks: 40;
- first median: **15.11 ms**;
- last median: **16.91 ms**;
- ratio: **1.119**;
- perceptionTick: **11**;
- spineSavings: **0.600**.

В другом локальном прогоне того же теста ratio составил **1.297**; разброс фиксируется, а не скрывается.

### Полный operational-250

После adaptive perception/cache изменений:

`LONG_HORIZON_OPERATIONAL_250=UNSTABLE`

Ранее воспроизведённый exposed-GC run:
- warmedMedianRatio: **1.694**;
- firstMedian: **155.02 ms**;
- lastMedian: **262.63 ms**;
- p95 approximation: **295.63 ms**;
- heapGrowth: **0.620**.

На финальном natural/npm запуске тот же 250-cycle workload может не завершиться в ограниченном verification window, поэтому результат маркируется **UNSTABLE**, а не PASS.

Это существенное изменение относительно состояния 34.9.0, где тот же gate мог не завершаться в коротком verification window.

### Что остаётся нерешённым

`operational-500-warm` ещё не получил гарантированный completion в доступном verification window. Поэтому 500/1000 cycles нельзя считать доказанно стабильными.

## 7. Проверка корректности существующей cognitive spine

Прошли:

- `BIG_PASS_40_SPINE`;
- `P64/P65` integration;
- `P67 project evidence`;
- typecheck;
- source truth;
- architecture;
- forensics;
- hygiene;
- release contract;
- archive manifest.

`BIG_PASS_41_PERFORMANCE_SPINE` подтверждает сохранение cognitive-spine scheduling.

## 8. Оценка первого аудита — что действительно выполнено

| Исходный пункт | Статус 34.10.0 |
|---|---|
| Stabilization | закрыт кодом; device validation нужна |
| OrganismCore decomposition | частично |
| Evidence Bus | закрыто базово |
| Prediction Ledger | закрыто и расширено |
| General learning substrate | частично |
| Goal ecology | существенно реализовано |
| Autonomous projects | существенно усилено |
| Reality research | частично |
| Reality boundary | существенно закрыто |
| Mobile cognitive OS | существенно закрыто |
| Model ecology | существенно усилено |
| Native Android host | не закрыт |
| Real perception | частично |
| Social cognition | частично |
| Predictive self-model | существенно усилен, но longitudinal benchmark нужен |
| Autobiographical identity | частично/существенно symbolic layer |
| Shadow organism | реализован, independence ограничена |
| Model Olympics | реализован |
| Development/self-modification | частично |
| Consciousness evaluation | исследовательский каркас без empirical proof |

## 9. Новые рекомендации, которые стали очевидны после этого прохода

### 9.1. Hot/cold cognitive tiering

Разделить операции по стоимости:

- **hot** — state, safety, agency, basic prediction;
- **warm** — memory retrieval, self-model, world update;
- **cold** — development, research, deep simulation.

Cold layer должен получать time slots из cognitive budget, а не автоматически жить внутри каждого cycle.

### 9.2. Allocation budget

Ввести отдельный metric:

`allocationsPerCycle`

и контролировать не только latency, но количество создаваемых объектов/copies.

### 9.3. Predictive prefetch

Cognitive cache может заранее загружать memory/world representations, которые с большой вероятностью понадобятся следующему goal/action.

### 9.4. Long-run memory compaction

Следующий уровень после текущего cadence — уменьшить размер сериализуемого hot state и число deep clones.

## 10. Оценки

| Область | % |
|---|---:|
| Mobile readiness | 77 |
| Runtime robustness | 84 |
| Persistence | 92 |
| Evidence quality | 91 |
| Cognitive Budget | 87 |
| Prediction infrastructure | 88 |
| Learning | 75 |
| Agency | 80 |
| Autonomous projects | 78 |
| Reality grounding | 83 |
| Self / Identity | 74 |
| Long-horizon | 70 |
| Architecture consolidation | 55 |
| Perception | 64 |
| Native Android lifecycle | 20 |
| Social cognition | 45 |
| Consciousness research readiness | 51 |

Общая инженерная готовность: **≈74%** (строгая оценка; она не включает невыполненные device/longitudinal validation).

## 11. Следование плану

### Следование первому аудиту

**≈79% actionable recommendations implemented/partially implemented** по первоначальному набору рекомендаций; строгая weighted implementation остаётся **≈74%**. Эти две метрики различаются: первая отражает покрытие пунктов, вторая учитывает глубину выполнения. Развёрнутая crosswalk-карта сохранена отдельно.

### Следование предыдущему BIG PASS 40

**≈100% технических задач, выбранных для исполнения.**

### BIG PASS 41 checklist

**100% machine-checkable tasks.**

## 12. Следующие большие проходы

### BIG PASS 42 — True External Project Executor

- не фиксированные три шага, а task graph;
- capability planning;
- failure branches;
- retry/backoff;
- external evidence;
- project memory;
- procedural skill acquisition benchmark;
- реальные внешние задачи через явный permission boundary.

### BIG PASS 43 — OrganismCore decomposition

- Self API;
- World API;
- Memory API;
- Learning API;
- Agency API;
- Embodiment API;
- event-only cross-boundaries;
- elimination of direct subsystem coupling.

### BIG PASS 44 — Native Android

- lifecycle;
- foreground service strategy;
- SoC thermal zones;
- camera/microphone;
- Termux bridge;
- restart/boot;
- device benchmark.

### BIG PASS 45 — Real Perception

- real vision backend;
- semantic scene graph;
- temporal object permanence;
- multimodal fusion;
- ASR/TTS.

## 13. Permanent scientific interpretation rules

- Internal score is not proof of consciousness.
- Simulation is not external evidence.
- Confidence is not correctness.
- Project completion is not independent validation.
- Successful test proves only its measured criterion.
- Performance gain must not be achieved by silently disabling cognition.
- Longitudinal external evidence has priority over internal self-report.


## 14. Final verification correction

Последний повторный набор на финальном дереве подтвердил: typecheck, BIG PASS 41, P64/P65, P67, P80-P82, source-truth, hygiene, architecture, forensics, release contract, archive manifest и full static audit — PASS.

`test:restart` в одной итоговой 120-секундной серии не завершился в окне проверки; поэтому текущий релиз **не утверждает**, что restart gate стабилен по wall-clock. Предыдущие PASS этого теста сохраняются как историческое доказательство, но нужна отдельная performance/restart campaign.

Финальный `BIG_PASS_41_PERFORMANCE_SPINE`: `tick=40`, `firstMedianMs=11.94`, `lastMedianMs=15.69`, `ratio=1.313`, `perceptionTick=11`, `spineSavings=0.600`.

Последний 250-cycle результат также не объявляется гарантированным PASS: operational benchmark чувствителен к GC/окружению. Один ранее воспроизведённый exposed-GC run дал `warmedMedianRatio=1.694`, `heapGrowth=0.620`, но естественный npm run в другом окне проверки может превышать лимит. Поэтому 500-cycle и длительные phone runs остаются открытыми.
