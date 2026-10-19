# Neuro-Kurisu — Integration Completion Scale

Последнее обновление: 2026-09-29 / PASS 10

Текущий официальный прогресс интеграций: **79.41%**. Расчёт приведён непосредственно по весам и значениям таблицы; прежнее объявленное 74.47% не совпадало с арифметикой этой же таблицы и здесь исправлено.

Это процент выполнения заранее определённого integration backlog, а не оценка сознания, AGI или общей готовности личности.

| Направление | Вес | До PASS 03 | Сейчас | Статус |
|---|---:|---:|---:|---|
| Mamba-style persistent recurrence | 10% | 100 | 100 | Закрыто |
| Recurrent/chunk dual execution | 8% | 100 | 100 | Закрыто |
| Preconditioned online learning | 8% | 100 | 100 | Закрыто |
| Memo-style canonical memory | 7% | 100 | 100 | Закрыто |
| Neural long-term memory | 8% | 80 | 95 | Глубокая интеграция |
| Hippocampal replay/composition | 8% | 85 | 98 | Grounded promotion gate |
| Active inference | 7% | 85 | 85 | Стабилизировано |
| Learned world model coupling | 9% | 35 | 91 | Сильный прогресс + verified replay |
| Slow/semantic consolidation | 7% | 50 | 81 | Глубокая интеграция + bounded recurrent protection + identity holdout |
| Learned self/personality coupling | 6% | 15 | 55 | Verified identity holdout + provisional/internal consistency gate |
| Embodiment/tool autonomy | 6% | 15 | 31 | Активная интеграция |
| Mobile/native acceleration | 4% | 0 | 20 | Runtime allocation reduction + mobile profile; native kernels не реализованы |
| Consciousness research substrate | 4% | 10 | 10 | Research track |
| Long-horizon validation | 8% | 20 | 60 | Grounded imagined-promotion + identity holdout + state-growth bounds; full-runtime 1000-cycle ещё открыт |

### PASS 03 добавил
- world → neural feedback;
- neural + memory → world transition learning;
- world transition → autonomous goal genesis;
- neural/world evidence → persistent memory context;
- явное сохранение/восстановление B2525 learned transition field через StateMigrations;
- dream rehearsal → P2724 replay/forgetting pressure;
- identity/personality continuity → bounded slow-memory consolidation;
- replay test lifecycle boundary теперь дожидается async stop();
- добавлены persistence и dream/replay executable gates.

### PASS 04 добавил
- neural uncertainty/error/novelty → adaptive replay-policy learning в P2724;
- semantic consolidation → bounded recurrent parameter protection;
- embodied sensorimotor consequence → обратный сигнал в P2750 world model;
- bounded multi-step model replay (до 3 шагов) с one-step fallback;
- identity/world/neural confidence → bounded long-timescale goal recalibration в P67;
- 1000-cycle compact endurance gates для P2724/P2750.

### PASS 05 добавил
- реальный runtime performance governor: wall-time/CPU/heap/RSS → bounded performance pressure;
- runtime performance pressure → Cognitive Resource Economy;
- p95 runtime cost → phone scheduler;
- performance pressure → mobile consolidation cadence;
- persistence/restart для performance history;
- 1000-sample performance endurance gate.

### PASS 06 добавил
- profiling-based identification of B301 whole-state serialization hotspot;
- cadence-aware B301 compaction: expensive sizing/compaction is deferred on normal cycles;
- immediate compaction override for elevated RAM/thermal pressure;
- preserved existing history limits and canonical branch protection;
- corrected brittle R7 source-guard paths to the current domain-owner layout;
- portable vector backend experiment explicitly rejected from runtime because current V8 benchmark did not demonstrate a gain.


### PASS 08 добавил
- content-hash deduplication для идентичного durable checkpoint payload в `FileStateStore`;
- fallback на повторную запись, если state-файл исчез внешне;
- `skippedUnchangedSaves` в persistence metrics;
- executable P2869 с проверкой suppression, changed-state write и restart load.

### PASS 07 добавил
- B294 duplicate-closure guard с сохранением взаимоисключающих runtime branches;
- CausalLifeGraph O(1) node/edge indexing и один полный feedback recordCycle вместо двух snapshot passes;
- causal lineage `obs:${tick+1}` + persistent B294 episode ID;
- bounded WorldModel2 memory/causal/transition state с 1000-cycle executable gate;
- mobile retention bounds для CognitiveDomainClosure, P40 semantic history, embodied transition log и neural replay;
- B301 scoped byte accounting без сериализации всего организма для определения saved bytes;
- Termux mobile V8 memory envelope `--max-old-space-size=192` с override;
- dedicated P2865/P2866/P2867/P2868 evidence gates;
- mobile V8 memory profile checked for cognitive semantic equivalence.


### PASS 09 добавил
- `VerifiedSyntheticTrajectoryGate`: imagined trajectories теперь только ставятся в pending hypothesis.
- Promotion в canonical neural `actionReadout` разрешён только после минимум двух реальных совпадений, минимум одного verified outcome и минимум одного holdout confirmation.
- Pending candidates bounded to 8 и expire после 24 ticks; есть rejection/expiration accounting и snapshot/restart support.
- P2870 executable gate.
- `NeuralExperienceBranch.afterOutcome()` получил bounded shared contexts/identity vectors вместо повторного создания одинаковых массивов на каждом subsystem call.
- Повторная временная CPU/RSS проверка P2868 показала улучшение profile gate без изменения action/tick/learning sequence.

### Следующий интеграционный блок
1. full-runtime 100/500/1000-cycle endurance с измерением wall-time, CPU/RAM и bounded state growth;
2. native/mobile acceleration backend с equivalence benchmark, без изменения cognitive semantics;
3. semantic consolidation → более строгая protection для долгих recurrent traces;
4. multi-step replay → grounded verification / holdout gate перед promotion;
5. identity/personality → более глубокая long-timescale value consolidation;
6. embodiment → external/tool action consequence loop с несколькими независимыми postcondition sources;
7. отдельная локализация тяжёлого `r12-upstream-replay-integration`.


### PASS 09 — расширение identity/runtime closure
- `B284NeuralAutobiographicalIdentityCore` получил отдельный evidence accumulator для identity revision: минимум повторяемых исходов, holdout-контекст и cooldown перед следующей revision.
- внешний/world outcome и внутренне согласованный simulation outcome разделены: simulation может породить только provisional revision path и не получает статус независимого доказательства.
- runtime `OrganismCore.feedback()` больше не строит одинаковый `b391ContextFromWorld(...)` много раз за один outcome; world context и компактный world-vector строятся один раз и переиспользуются.
- `TemporalContinuityEngine.calendarContext()` использует exact-timestamp cache для сокращения повторных Date/Intl вычислений без изменения календарного значения.
- P2871 проверяет external identity holdout + cooldown + snapshot/restore.
- P2872 проверяет runtime provisional identity path + restart persistence.

### Текущий незакрытый блок
- полный `OrganismRuntime` 100/500/1000-cycle endurance остаётся открытым и не подменяется компактными stateful gates;
- native NEON/SIMD/NNAPI backend не объявляется реализованным без реального выигрыша и device evidence;
- тяжёлый `r12-upstream-replay-integration` не считается PASS.

### PASS 10 — runtime hot-path closure
- primitive-only runtime metadata view вместо повторного deep-clone `systemSnapshot()` в OrganismRuntime journal/continuity hot path;
- `P2835.metricsLite()` для частых scalar diagnostics без cloning context matrices;
- P2873 executable gate на clone-free metadata path;
- P2874 boundary gate для separation performance-governor telemetry и resource-allocation semantics;
- измеренный host-profile результат: примерно 556 → 388 ms/cycle average и 766 → 565 ms p95 на сравнительном профиле.
