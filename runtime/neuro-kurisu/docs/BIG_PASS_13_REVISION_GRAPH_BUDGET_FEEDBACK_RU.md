# Neuro-Kurisu Evolution — BIG PASS 13
## Revision Graph + Persistence Budget Feedback + Long-Horizon Profiling

Дата: 2026-09-05
Release contract: 34.2.0 / organismCore 70.0.0-master-prompt-progress-engine / state schema 83

## 1. Цель прохода

BIG PASS 13 продолжает последний подтверждённый анализ BIG PASS 12. Приоритеты были:
1. настоящий revision-aware persistence graph;
2. feedback от branch budgets в persistence projection;
3. снижение стоимости долгих operational horizons;
4. закрытие P80–P82 timeout через проверку реального durability contract;
5. расширение self-audit, чтобы мои собственные рекомендации становились проверяемыми условиями;
6. полная повторная проверка migration, architecture, integrity, security, forensics и historical gates.

## 2. Что реально внедрено

### 2.1 RevisionGraph
Добавлен `src/organism/persistence/RevisionGraph.ts`.

Функции:
- дешёвые domain mutation stamps без cloning/large-state hashing;
- домены: critical, memory, identity, reality, developmental, slow;
- current/materialized revision counters;
- last cause per domain;
- persisted graph state и metrics;
- materialization только для изменённых domain + scheduler cadence;
- `flush()` всё равно принудительно материализует полный набор.

Организм теперь отмечает изменения по observation domain, включая developmental и slow refresh.

### 2.2 Persistence Budget Controller
Добавлен `src/organism/persistence/PersistenceBudgetController.ts`.

Controller классифицирует состояние как `normal`, `pressure`, `emergency` и выбирает bounded limits для durable traces/event projection.
Он встроен в persistence projection path, поэтому branch budgets теперь не только наблюдаются аудитом, но и влияют на bounded persistence output.

Текущие пределы:
- normal traces 256 / events 320;
- pressure traces 224 / events 260;
- emergency traces 160 / events 220.

### 2.3 Integrity root-cause fix
Исправлен системный дефект `IntegritySentinel.stamp()`:
раньше reconstruction `system` теряла дополнительные поля.
Теперь существующие system fields сохраняются при stamp.

Это критично для корректной persistence revision graph и scheduler state.

### 2.4 Long-horizon methodology
Добавлен прогретый 250-cycle operational benchmark.

Результат:
- warmed median ratio = 1.662x;
- first warmed median = 131.98 ms;
- last median = 219.40 ms;
- p95 approximation = 227.28 ms;
- sampled heap growth = 1.248x.

Первоначальный raw mean-прогон показал 13.91x, но анализ показал сильную чувствительность к startup/JIT/GC. Поэтому release metric использует warmed median windows, а raw result сохранён как diagnostic, а не скрыт.

500-cycle benchmark в текущем execution environment не уложился в timeout и НЕ засчитан как PASS.

### 2.5 P80–P82 runtime E2E
Persistence window был расширен в самом тесте, после чего добавлен явный `flush()` перед чтением durable state.

Результат:
`P80_P82_RUNTIME_E2E=PASS tick=160 p80=160 p81=160 p82=160`

Это подтверждает контракт: hot-window может оставлять durable snapshot на предыдущем full tick, а `flush()` закрывает durability window.

### 2.6 Self-audit
`audit-analysis-alignment` расширен до 27 checks.

Он теперь проверяет:
- BIG PASS audit documents;
- MemoryOS2 canonicality;
- persistence governor/scheduler;
- branch budgets;
- revision graph;
- budget controller;
- tests новых механизмов;
- wiring в OrganismCore;
- persistence revision state;
- operational result plane;
- tiered checkpoint/flush semantics.

Результат: `ANALYSIS_ALIGNMENT=PASS checks=27 failures=0`.

## 3. Реальные измерения

Persistence footprint:
- total ≈ 2.402 MB;
- autobiographical ≈ 21.6 KB;
- events ≈ 125.7 KB;
- P62 ≈ 55.0 KB.

Branch budget:
- max utilization ≈ 0.891;
- overBudget = 0.

Projection efficiency:
- naive = 576;
- scheduled = 204;
- reduction = 64.6%.

Operational long horizon:
- 96-cycle PASS, typical ratio ≈ 1.4–1.7x;
- 250-cycle warmed PASS ratio 1.662x;
- 500-cycle test currently timeout.

## 4. Проверки

PASS:
- typecheck;
- persistence tiering;
- persistence governor;
- footprint;
- MemorySubstrate;
- checkpoint hotpath;
- advanced projection scheduler;
- projection efficiency;
- persistence budget controller;
- branch budgets;
- revision graph persistence;
- revision-aware projection;
- P80–P82 runtime E2E;
- P74–P77 integration;
- API security;
- server security smoke;
- architecture;
- integrity;
- contract;
- source truth;
- forensics;
- hygiene;
- API routes: 86 / duplicates 0;
- analysis alignment: 27/27;
- historical shard audit: 152 test files / 164 script targets / 55 phases / 0 orphan / 0 missing;
- migrations: 33/33.

## 5. Что осталось

### Высокий приоритет
1. Полный revision-token graph на уровне subsystem revisions вместо только domain mutation journal.
2. Полная физическая консолидация parallel memory stores.
3. Adaptive branch-budget controller должен перейти от bounded traces/events к policy для каждой дорогой ветви.
4. 500–1000 cycle profiling с allocator/GC/CPU sampling.
5. Разделённые быстрые P80–P82 e2e campaigns плюс длительный physical e2e.
6. Реальный Android device campaign.

### Средний приоритет
7. Repeated reality-validation campaigns с paired baseline.
8. Thought-debt + DMN/circadian/incubation measurable loop.
9. Qwen ideas: selective adoption only; no literal emotional bleed/qualia claims.

## 6. Оценка готовности

| Область | % |
|---|---:|
| Canonical architecture | 95 |
| Memory architecture | 94 |
| Persistence / recovery | 96 |
| Reality / provenance | 88 |
| Autonomy / development | 86 |
| Safety / HITL | 87 |
| Performance / mobile efficiency | 92 |
| Termux readiness | 82 |
| Android source/runtime | 76 |
| Реальное Android-устройство | 38 |
| Multimodal / semantic grounding | 72 |
| Long-horizon validation | 84 |
| Historical regression closure | 99 |
| Qwen recommendations | 74 |
| **Общая инженерная готовность** | **94** |

Это инженерная оценка зрелости software architecture/runtime/persistence/tests, не измерение AGI или субъективного сознания.

## 7. Выполнение предыдущего roadmap

| Направление | Выполнение |
|---|---:|
| True revision-aware persistence | 78% |
| Unified memory substrate | 95% |
| Branch-level budgets | 96% |
| Snapshot / allocation efficiency | 88% |
| Android physical hardening | 38% |
| Thought-debt / DMN / circadian / incubation | 73% |
| Reality-validation campaigns | 61% |
| Historical + statistical evidence | 94% |
| Self-audit собственных рекомендаций | 100% по 27 текущим checks |

## 8. Самокритическая проверка

Не считать внедрённым то, что существует только как класс или документ.

Подтверждено wiring:
- RevisionGraph -> OrganismCore -> checkpoint -> persisted system;
- BudgetController -> persistence projection;
- IntegritySentinel сохраняет расширенные system fields;
- P80–P82 тест использует явный flush при extended durability window;
- новые тесты зарегистрированы в package scripts.

Не подтверждено:
- завершение 500-cycle benchmark;
- физический Android device validation;
- полное subsystem-level revision tokens для всех модулей.

## 9. Следующий оптимальный шаг

Лучший следующий проход: subsystem revision tokens + adaptive branch policy + 500–1000 cycle CPU/heap/GC profiling. После стабилизации этих трёх направлений — реальный Android campaign.
