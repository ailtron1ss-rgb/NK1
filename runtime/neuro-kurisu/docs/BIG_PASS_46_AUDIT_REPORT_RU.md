# Neuro-Kurisu 34.16.0 — BIG PASS 46
## Multi-Project Agency + Model Ecology 2 + First-Audit Full Recheck

Дата: 2026-09-05
Статус: research-release

## 1. Baseline

Главный baseline этого прохода — самый первый полный аудит проекта и его сохранённый crosswalk. Дополнительно проверены BIG PASS 45 и текущие machine-checkable checklist. В этом проходе запрещено считать интерфейс новой системой без реального runtime effect.

## 2. Реально сделано

### 2.1 MultiProjectScheduler
Добавлен детерминированный resource-aware scheduler для нескольких активных self-projects. Он учитывает priority, commitment, identity relevance, progress room, evidence debt, uncertainty, goal pressure, cognitive load, energy и available budget.

Это впервые делает существующую ёмкость selfProjects >1 реальной частью action selection вместо постоянного обслуживания только selected/first-active проекта.

### 2.2 Starvation prevention
Для заброшенных во времени проектов используется bounded recency debt. Scheduler получает `at` в wall-clock milliseconds и больше не смешивает tick time с `lastWorkedAt`.

### 2.3 Continuity hysteresis
При почти равных scores текущий проект удерживается с margin 0.04. Это предотвращает переключательный churn и сохраняет стабильность long-running cognition.

### 2.4 Project switch event lineage
Добавлен event type `project-switch`. При реальном переключении active project событие записывается в EventSourcing с from/to project IDs, reason и score map. Выбор проекта становится частью воспроизводимой истории субъекта.

### 2.5 SelfProjectEngine
Добавлены `activeProjects()` и `selectProject()`. Это минимальная физическая mutation boundary, позволяющая scheduler-у менять current project без доступа к внутреннему массиву состояния.

### 2.6 Model Olympics 2
Model Olympics получил медленно затухающие historical scores. Старые prediction rounds больше не могут бесконечно доминировать над новой реальностью.

Сохраняется schema 89: изменён только алгоритм интерпретации существующего score state, без нового persisted schema contract.

### 2.7 Release source-of-truth
Release поднят до 34.16.0.
Schema осталась 89.
Phase: `Stage-2/cognitive-kernel-decomposition-4/multi-project-model-competition`.

Обновлены VERSION.json, package.json, package-lock, ReleaseContract, manifests и current documentation markers.

### 2.8 Forensics correction
Исправлен false-positive в `audit-forensics.mjs`: detector интерпретировал собственное regex expression как реальный Windows absolute path. Detector теперь ищет абсолютные пути только в реальном text context и продолжает блокировать реальные path leaks.

Это изменение относится к quality infrastructure, а не к cognition, но важно для честности release audits.

## 3. Regression evidence

### BIG PASS 46
`BIG_PASS_46_MULTI_PROJECT_MODELS=PASS`

Подтверждено:
- multi-project scoring;
- starvation prevention;
- continuity hysteresis;
- model score decay;
- empirical calibration;
- SelfProjectEngine project switching;
- core integration;
- project-switch event lineage.

### 250 cycles
`LONG_HORIZON_OPERATIONAL_250=PASS`
- warmedMedianRatio: 1.504
- firstMedianMs: 18.76
- lastMedianMs: 28.21
- p95ApproxMs: 30.15
- heapGrowth: 2.243

### 500 cycles
`LONG_HORIZON_OPERATIONAL_500=PASS`
- ratio: 4.686
- firstMs: 7.66
- lastMs: 35.91
- p95: 36.51
- heapFirst: 26.80 MB
- heapLast: 90.39 MB

### 1000 cycles
`LONG_HORIZON_OPERATIONAL_1000=PASS`
- ratio: 2.231
- firstWarmMs: 18.00
- lastMs: 40.16
- p95: 43.56
- heapFirst: 48.31 MB
- heapLast: 79.59 MB
- canonical memory: 224

Это последний финальный 34.16.0 measurement после scheduler/hysteresis/event изменений.

## 4. Full regression status

PASS:
- typecheck;
- BIG PASS 46 multi-project/model test;
- BIG PASS 45 architecture-performance test;
- P64/P65 integration;
- P67 project evidence;
- P80/P82 runtime E2E;
- organism smoke;
- restart persistence;
- memory dedup;
- identity lock;
- replay;
- concurrency;
- operational hardening;
- server smoke (separately executed);
- persistence projection tiering/governor;
- projection efficiency;
- full static audit;
- architecture;
- forensics;
- hygiene;
- lockfile;
- release contract;
- subject boundary;
- API routes;
- release source;
- long-horizon 250/500/1000.

Composite `audit:all` was attempted, but the aggregate command reached its overall execution window during the server-smoke sequence. The server-smoke test itself was executed separately and passed. Therefore composite `audit:all` is not claimed as a complete PASS.

## 5. First-audit full crosswalk

### Fully implemented or strongly operationalized
- P40 backend health/failure learning;
- adaptive mobile scheduling;
- Runtime Evidence Bus;
- Prediction Ledger;
- Evidence trust separation;
- Cognitive Budget;
- simulator != external truth;
- project evidence classes;
- autonomous project executor;
- Cognitive Quorum;
- Model Olympics base + decay;
- Cognitive Cache foundation;
- adaptive perception cadence;
- bounded persistence;
- long-horizon 500/1000 operational gates;
- Cognitive Kernel coordinator boundary;
- multi-project scheduling;
- project switch event lineage.

### Partial
- P30 general learning substrate;
- self-prediction external calibration;
- causal research with true interventions;
- learned world-model competition;
- Shadow Organism independence;
- information-gain economy as full action principle;
- social cognition;
- multimodal semantic perception;
- Cognitive Immune System as independent subsystem;
- Dream Compiler;
- Cognitive Death lifecycle;
- Pareto identity pressure;
- true external project ecosystem;
- real skill acquisition benchmark.

### Not yet proven
- native Android lifecycle host;
- semantic vision backend;
- device ASR/TTS campaign;
- 24h/72h/7d/30d physical-device evidence;
- independent consciousness evaluation;
- phenomenal consciousness claim.

## 6. Strict progress

Мой текущий weighted implementation estimate относительно исходного первого аудита: **≈88%**.

Это не 88% сознания и не 88% человеческого интеллекта. Это оценка того, какая доля исходных engineering recommendations уже имеет реальную implementation/effect and/or strong validation.

## 7. Readiness matrix

| Область | Прогресс |
|---|---:|
| Mobile readiness | 84% |
| Runtime robustness | 91% |
| Persistence | 94% |
| Evidence quality | 94% |
| Cognitive Budget | 91% |
| Prediction infrastructure | 92% |
| Learning | 79% |
| Agency | 87% |
| Autonomous projects | 88% |
| Reality grounding | 88% |
| Self / Identity | 78% |
| Long-horizon | 84% |
| Architecture consolidation | 67% |
| Perception | 66% |
| Native Android lifecycle | 20% |
| Social cognition | 48% |
| Consciousness research readiness | 53% |

## 8. Recommendations from previous audits — status

| Recommendation | Status 34.16.0 |
|---|---|
| hot/cold cognitive tiers | ✅ |
| one-tick shared cognition | ✅ |
| durable-only full hashing | ✅ |
| bounded memory growth | ✅ |
| long-horizon operational gates | ✅ |
| prediction -> outcome -> learning loop | ✅/◐ |
| project -> evidence -> skill loop | ✅/◐ |
| multi-project agency | ✅ |
| independent external tasks | ◐ |
| learned Model Olympics | ◐ |
| Shadow Organism | ◐ |
| real causal interventions | ◐ |
| real multimodal vision | ❌ |
| native Android host | ❌ |
| social cognition | ◐ |
| longitudinal physical-device evidence | ❌ |
| consciousness evaluation | ❌ |

## 9. Special principles introduced

### Eventual-Consistency Cognition
Hot, warm and cold state do not need identical temporal resolution.

### Project Starvation Debt
A project which is continuously neglected accumulates bounded scheduling pressure without becoming permanently dominant.

### Evidence-Aware Agency
A project is not considered successful merely because its internal progress increased; external and replicated evidence remain separate gates.

### Model Half-Life
Prediction models can lose authority when reality changes. Historical performance is useful but not immortal.

## 10. Next big passes

### BIG PASS 47
Physical SelfSystem / WorldSystem / MemorySystem extraction from OrganismCore while preserving single state and event lineage.

### BIG PASS 48
Real External Project Engine: safe browser/network/research adapters, outcome validation, tool sandboxing and long-running project workflows.

### BIG PASS 49
Shadow Organism 2 + learned multi-model world tournament.

### BIG PASS 50
Native Android Host and real lifecycle/power/sensor integration.

### BIG PASS 51
Real multimodal perception.

## 11. Hard rule for next passes

Не добавлять новые P-номера, пока существующие systems не приобретают более глубокое causal effect, external grounding, long-horizon learning и real-world validation.
