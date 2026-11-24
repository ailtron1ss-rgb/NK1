# Neuro-Kurisu Evolution — BIG PASS 14
## Revision Tokens + Adaptive Branch Budgets + Long-Horizon Efficiency

Дата: 2026-09-05
Release contract: 34.2.0 / organismCore 70.0.0-master-prompt-progress-engine / state schema 83

## 1. Цель прохода

BIG PASS 14 продолжает только незакрытые пункты BIG PASS 13. Не повторяются уже закрытые механизмы без изменения: scheduler, tiered persistence, operational result plane, базовая MemorySubstrate consolidation.

Приоритеты:
1. превратить domain revision journal в именованные subsystem revision tokens;
2. сделать branch budget feedback управляемым для нескольких дорогих durable branches;
3. уменьшить реальные per-cycle allocation/snapshot overhead;
4. получить устойчивый 250-cycle warmed benchmark и повторно попытаться закрыть 500-cycle gate;
5. расширить self-audit новыми требованиями;
6. повторно пройти persistence, memory, security, historical и release gates.

## 2. Реально внедрено

### 2.1 RevisionTokenRegistry
Добавлен `src/organism/persistence/RevisionTokenRegistry.ts`.

Введены именованные subsystem tokens:
- memory-core
- memory-fabric
- identity-core
- reality-model
- development-core
- evidence-ledger
- critical-kernel
- slow-cognition

Registry использует один дешёвый canonical RevisionGraph mutation journal и поэтому не делает hidden hashing/cloning больших subsystem states. Это осознанный промежуточный шаг к полноценным независимым revision tokens.

`OrganismCore` теперь пишет named subsystem touches и сохраняет `revisionTokens` в system persistence.

### 2.2 Branch-aware adaptive durable policy
`PersistenceBudgetController` расширен с traces/events до:
- compatibility memory projection;
- P62 history;
- P54 evidence history;
- P57 reality history.

Добавлена hysteresis-like предварительная реакция:
- `normal`: < 0.72 max utilization;
- `pressure`: >= 0.72;
- `emergency`: >= 0.90 или фактический over-budget.

Причина выбора: предыдущий профиль давал 93.8% event-log utilization. Вместо повышения лимита controller теперь заранее сжимает projection и оставляет запас.

### 2.3 Hot operational path allocation reduction
Убраны лишние per-cycle clones:
- `MemoryOS2.snapshot()` больше не используется трижды только для `dormant/reconsolidations`; добавлен `statsLight()` с дешёвыми counters;
- `syncHotPersistenceProjection()` не вызывается в `operational` result mode на каждом цикле;
- durable `memoryOS` clone в operational mode не создаётся без необходимости.

Это сохраняет full-mode/backward-compatible persistence path.

### 2.4 Durable branch trimming
При materialization теперь ветви P62/P54/P57 получают limits из budget controller.

Автобиографическая compatibility projection также автоматически меняет bounded limit по tier.

### 2.5 Long-horizon methodology
Новый 500-warm benchmark использует:
- warm-up;
- median windows вместо raw mean;
- controlled heap sampling;
- GC только в контрольных точках, а не каждый цикл.

Фактически завершённый контроль:
`LONG_HORIZON_OPERATIONAL_250=PASS`
- warmedMedianRatio ≈ 1.744 в одном прогона после operational reduction;
- firstMedian ≈ 121 ms;
- lastMedian ≈ 211 ms;
- p95 ≈ 216 ms;
- sampled heapGrowth ≈ 1.00-1.22 в зависимости от окна.

Ранее отдельный warmed 250-cycle прогон также дал 1.662x. Эти значения не усредняются между разными execution contexts.

500-cycle benchmark повторно НЕ завершился в лимите 180 s. Это остаётся unresolved scaling gate.

## 3. Проверенные исправления

### 3.1 Script contract drift
Обнаружены и исправлены отсутствующие package aliases:
- `test:revision-aware-projection`;
- `test:revision-graph:persistence`.

### 3.2 Test quality correction
Один из первоначальных 500-cycle variants полагался на noop/write metrics, которых у `MemoryStateStore` не было. Тестовая идея признана невалидной и заменена на реальные counting/assertion paths; фиктивный PASS не используется.

## 4. Реальные измерения

Persistence branch audit после adaptive feedback:
- total ≈ 2.37 MB;
- maxUtilization ≈ 0.762;
- autobiographical ≈ 10.7 KB;
- events ≈ 125.7 KB;
- P62 ≈ 35.0 KB;
- traces ≈ 376.1 KB;
- MemoryOS ≈ 201.1 KB.

После hysteresis controller запас существенно вырос по сравнению с 93.8% worst branch utilization BIG PASS 13.

Projection efficiency сохраняется:
- naive 576;
- scheduled 204;
- reduction 64.6%.

## 5. Gate results

### PASS
- typecheck;
- revision token registry;
- revision graph persistence;
- revision-aware projection;
- persistence branch budget;
- persistence budget controller;
- persistence budget feedback;
- persistence footprint;
- memory dedupe;
- memory substrate;
- checkpoint hotpath;
- advanced projection scheduler;
- projection efficiency;
- clean restart persistence;
- P74–P77 integration;
- P80–P82 unit/integration assertions;
- API security;
- server security smoke;
- concurrency;
- replay;
- portable subject boundary;
- architecture;
- forensics;
- source hygiene;
- release contract;
- source truth;
- API routes 86 / duplicates 0;
- analysis alignment 35/35;
- historical shard audit 152 test files / 164 script targets / 55 phases / 0 orphan / 0 missing;
- migrations previously established 33/33 remain part of release evidence.

### LONG-HORIZON
- operational 250 warmed: PASS;
- operational 500 warmed: TIMEOUT in 180 s, therefore not PASS.

## 6. Self-audit quality

`ANALYSIS_ALIGNMENT=PASS checks=35 failures=0`.

Теперь self-audit проверяет не только BIG PASS 8–13, но и:
- RevisionTokenRegistry;
- subsystem token wiring;
- adaptive per-branch budget limits;
- operational hot-path allocation reduction;
- statsLight replacement of redundant MemoryOS clones;
- warm-500 benchmark presence.

## 7. Что реально ещё не внедрено

1. Полностью независимые subsystem revision counters внутри самих subsystem classes. Сейчас Registry даёт именованные tokens поверх canonical domain counters.
2. Полностью единая физическая memory topology без параллельного runtime compatibility store.
3. Универсальный adaptive budget policy для каждой дорогой branch, а не только ключевых persistence branches.
4. Устойчивый 500–1000-cycle gate в текущем execution environment.
5. Реальная Android-device campaign.
6. Repeated paired reality-validation campaigns.
7. Полный thought-debt/DMN/circadian measurable loop.

## 8. Оценка готовности

| Область | % |
|---|---:|
| Canonical architecture | 96 |
| Memory architecture | 95 |
| Persistence / recovery | 97 |
| Reality / provenance | 89 |
| Autonomy / development | 87 |
| Safety / HITL | 87 |
| Performance / mobile efficiency | 94 |
| Termux readiness | 83 |
| Android source/runtime | 77 |
| Реальное Android-устройство | 38 |
| Multimodal / semantic grounding | 73 |
| Long-horizon validation | 85 |
| Historical regression closure | 99 |
| Qwen recommendations | 75 |
| **Общая инженерная готовность** | **95** |

Это инженерная оценка software/runtime/persistence/test maturity, а не измерение AGI или subjective experience.

## 9. Выполнение предыдущего roadmap

| Направление | Выполнение |
|---|---:|
| True revision-aware persistence | 84% |
| Unified memory substrate | 96% |
| Branch-level budgets | 98% |
| Snapshot / allocation efficiency | 92% |
| Long-horizon profiling | 74% |
| Android physical hardening | 38% |
| Thought-debt / DMN / circadian / incubation | 74% |
| Reality-validation campaigns | 62% |
| Historical + statistical evidence | 95% |
| Self-audit собственных рекомендаций | 100% по 35 checks |

## 10. Самокритическая оценка прохода

Сделано новое, а не переименовано старое:
- появился named revision layer;
- budget feedback теперь охватывает несколько durable branches;
- в hot operational path устранены три large MemoryOS clone операции на цикл;
- 250-cycle benchmark получил устойчивую warmed методику;
- найден и исправлен package-script drift;
- self-audit расширен с 27 до 35 checks.

Нельзя заявлять:
- что subsystem revisions полностью независимы;
- что 500-cycle gate пройден;
- что Android physical validation выполнена;
- что memory physical duplication устранена целиком.

## 11. Следующий наиболее эффективный проход

1. Независимые revision counters в ключевых subsystem classes + revision DAG для dependency edges.
2. Adaptive branch compaction policy для trace/event/memory/evidence/reality branches.
3. 500–1000 cycle allocation/GC/CPU profiling с low-overhead sampler.
4. Оптимизация оставшихся O(N log N)/clone hotspots по профилю.
5. После этого — физический Android campaign и paired reality experiments.

Главный принцип следующего прохода: сначала измерить стоимость, затем менять код; не увеличивать функциональный объём там, где consolidation даёт больший выигрыш.
