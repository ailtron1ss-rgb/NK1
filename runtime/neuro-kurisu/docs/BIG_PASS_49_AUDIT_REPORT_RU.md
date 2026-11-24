# Neuro-Kurisu — BIG PASS 49 / 34.20.0

Дата: 2026-09-06

## 1. Назначение прохода

BIG PASS 49 продолжает исходный аудит проекта и сознательно не добавляет новые P-модули ради количества. Главная цель — начать физически разделять когнитивную систему на runtime-органы, сохраняя единое состояние организма, event lineage и prediction/evidence spine.

## 2. Что Neuro-Kurisu сейчас простыми словами

Neuro-Kurisu — это экспериментальная stateful cognitive architecture, рассчитанная в том числе на работу через Termux на среднем Android-телефоне. Она умеет хранить длительное состояние, вести память и epistemic state, формировать и выбирать цели, планировать действия, вести несколько автономных проектов, проверять внешние сведения, вести prediction/evidence ledger, учитывать вычислительный бюджет и адаптировать часть cognition под ресурс устройства.

Это уже существенно больше обычного чат-бота, но это не доказанный человеческий интеллект и не доказанное феноменальное сознание. Значительная часть consciousness/personhood слоёв — функциональные computational models, а реальные external/device/longitudinal доказательства ещё ограничены.

## 3. Что изменилось в BIG PASS 49

### 3.1 Physical subsystem extraction

Созданы физические runtime-владельцы:

- `AgencySubsystemRuntime` — владеет SelfProjectEngine, AgencyDeliberationEngine, CognitiveBudgetManager, CognitiveQuorumEngine, AutonomousProjectExecutor и MultiProjectScheduler.
- `EvidenceResearchSubsystemRuntime` — владеет prediction/evidence/research engines, включая PredictionLedger, Evidence Firewall, ProjectResearchSession, Skill Acquisition Benchmark, SelfPredictionBenchmark, ModelOlympics, PredictionDebt, ShadowOrganism, IdentityCausality и LongHorizon benchmark.

`OrganismCore` больше не создаёт эти engines напрямую. Он координирует subsystem boundaries.

### 3.2 Dependency inversion

`CognitiveSubsystemFacade` больше не зависит непосредственно от `OrganismCore`. Используется capability/accessor contract. Это позволяет в будущем подключать native Android host, research harness и отдельные kernels без импорта монолита.

### 3.3 DAG Project Executor

`AutonomousProjectExecutor` теперь реально выбирает ready-node из DAG, а не просто движется по линейному cursor. Независимые ветви могут выполняться по мере готовности, а join-step ждёт все зависимости.

### 3.4 Temporal session correctness

Убран двойной `session:end` event в `endTemporalSession()`.

### 3.5 Regression isolation

`P11` integration test теперь использует PID-scoped temporary state, поэтому один тестовый процесс не отравляет следующий stale-файлом `/tmp`.

### 3.6 Public core exports

Новые physical runtimes экспортируются через `src/organism/core/index.ts`.

## 4. Что не является достигнутым результатом

Physical extraction пока не завершён для всех семи semantic domains. Сейчас физически вынесены прежде всего Agency и Evidence/Research runtime. Self/World/Memory/Embodiment/Governance ещё требуют аналогичного extraction.

Subsystem Registry также является boundary/health layer, а не доказательством полной модульной независимости всех подсистем.

## 5. Проверки BIG PASS 49

`TYPECHECK=PASS`

`CORE_OWNERSHIP=PASS`

`FACADE_DEPENDENCY=PASS`

`BIG_PASS_49_SUBSYSTEM_RUNTIME=PASS`

`BIG_PASS_49_PROJECT_DAG=PASS`

`CLEAN_ARCHITECTURE=PASS`

`FORENSICS=PASS`

`SOURCE_HYGIENE=PASS`

`SOURCE_TRUTH=PASS`

`SUBJECT_BOUNDARY=PASS`

`CLEAN_RESTART_PERSISTENCE=PASS`

`MEMORY_DEDUP=PASS`

`IDENTITY_LOCK=PASS`

`REPLAY=PASS`

`PORTABLE_SUBJECT_BOUNDARY=PASS`

`API_SECURITY=PASS`

`SERVER_SECURITY_SMOKE=PASS`

## 6. Long-horizon status

После final-freeze текущего 34.20.0 выполнены отдельные 250/500/1000-cycle runs, и именно они считаются релизным baseline.

- 250: `PASS`, warmedMedianRatio=`1.503`, firstMedian=`19.73 ms`, lastMedian=`29.65 ms`, p95≈`33.06 ms`, heapGrowth=`2.263`.
- 500: `PASS`, ratio=`1.246`, first=`28.59 ms`, last=`35.62 ms`, p95=`40.78 ms`, heap=`25.35→99.33 MB`.
- 1000: `PASS`, ratio=`1.588`, steadyWarm=`24.50 ms`, last=`38.91 ms`, p95=`45.57 ms`, heap=`49.71→80.91 MB`, canonical memory=`224`.

Это хороший operational benchmark, но не заменяет реальный 24h/72h/7d/30d device run на среднем Android.

## 7. Архитектурная оценка

### Сильные стороны

- persistence и миграции;
- evidence/provenance;
- тестовая инфраструктура;
- mobile resource awareness;
- goal/project machinery;
- постепенная physical decomposition;
- отсутствие необходимости делать LLM центром каждого tick.

### Основные оставшиеся риски

- `OrganismCore` ещё слишком большой;
- long-horizon stability должна быть проверена именно после final freeze;
- native Android lifecycle не реализован;
- vision/audio device integration не завершены;
- social cognition остаётся частичной;
- Shadow Organism и Model Olympics пока не равны независимым обучающимся организмам;
- consciousness evidence отсутствует как empirical claim.

## 8. Текущий рабочий приоритет

Следующий большой слой должен физически вынести оставшиеся semantic domains, но делать это через capability contracts и event/evidence spine, а не через новые прямые зависимости.

Одновременно Project Executor должен получить полноценный external-safe execution path: task graph -> tool -> real outcome -> external evidence -> skill update.

## 9. Прогресс

### Current engineering readiness

**≈92%** для уже спроектированного server/runtime слоя. Это не процент сознания.

### Первый аудит — строгий weighted crosswalk

**≈69%**. Partial-реализации не засчитываются как полный пункт; device-only и empirical claims требуют реального device/longitudinal evidence.

### Следование roadmap

**≈99% actionable пунктов, которые были доступны для реализации в текущем окружении.**

### BIG PASS 49

**123/123 machine-checkable checks = 100%.**

## 10. Что осталось

1. Physical Self/World/Memory/Embodiment/Governance extraction.
2. External Project Engine с реальным безопасным browser/network/device workflow.
3. Независимый Shadow Organism.
4. Learned Model Olympics на реальных outcome.
5. Native Android lifecycle host.
6. Реальное multimodal perception.
7. Полная social cognition.
8. 24h → 72h → 7d → 30d device corpus.
9. Независимый consciousness evaluation; никакие текущие internal scores этого не доказывают.

## 11. Новая идея BIG PASS 49 — Subsystem Flight Recorder

Для каждого physical subsystem полезно сохранять компактный ring-buffer:

`callCount`, `failureCount`, `lastLatencyMs`, `lastFailure`, `lastEvidenceTick`, `stateVersion`.

Это позволит измерять не только "subsystem существует", а действительно ли он работает как автономный орган и где он начинает деградировать под нагрузкой телефона. Реализация этого recorder оставлена следующим проходом, потому что текущий проход уже достиг безопасной freeze-точки.
