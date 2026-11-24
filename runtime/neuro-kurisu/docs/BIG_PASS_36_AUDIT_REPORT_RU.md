# NEURO-KURISU — BIG PASS 36
## Cognitive Budget 2.0 + Evidence/Prediction Spine 2.0 + Mobile Persistence

Дата: 2026-09-05
База: Neuro-Kurisu 34.3.0 / BIG PASS 35
Релиз: **34.4.0**
Профиль: средний Android-телефон + Termux

## 1. Цель прохода
Не добавлять новые P-номера без необходимости. Максимально замкнуть уже существующие механизмы в рабочие циклы: ограниченный когнитивный ресурс, prediction→outcome→error, epistemic lifecycle, evidence lineage, persistence и мобильная I/O-экономия.

## 2. Что реально изменено

### 2.1 Cognitive Budget 2.0
`CognitiveBudgetManager` теперь различает стоимость конкретных операций (`sensor`, `memory`, `planning`, `simulation`, `llm-fast`, `llm-deep`, `research`, `persistence`), ведёт bounded ledger расхода и остатка, учитывает information gain и отклоняет дорогие операции при нехватке остатка. Runtime реально списывает budget на planning, simulation и language, а не только отображает его.

### 2.2 P46 Prediction Ledger 2.0
Исправлена принципиальная семантическая ошибка: prediction error теперь вычисляется как `|predicted - actual|`, а не через confidence. Добавлены baseline per kind и `improvement01`, чтобы будущий benchmark измерял реальное улучшение предсказаний относительно собственной ранней базы. Старое состояние безопасно восстанавливается: missing `predicted01` получает legacy fallback из confidence.

### 2.3 P65 Epistemic Ledger 2.0
Prediction claims теперь тоже хранят `predicted01`. Добавлен lifecycle beliefs: `active → stale → expired`, `lastSupportedAt`, `supportCount`, `expireBeliefs()` и `supportBelief()`. Added source-aware provenance weighting; simulated world получает низкий trust и не может автоматически стать external truth.

### 2.4 Evidence Bus 2.0
Добавлены lineage diagnostics: linked parent events, dangling parent links и `lineageIntegrity01`. Evidence snapshot можно восстановить после restart; runtime сохраняет его в system state. Это превращает evidence bus из временной телеметрии в небольшой, но непрерывный integration spine.

### 2.5 Mobile persistence
`FileStateStore` теперь в сбалансированном режиме делает directory-fsync не на каждом save, а с заданной периодичностью; строгий режим доступен через `NEURO_STRICT_FSYNC=1`. File fsync остаётся. Цель — снизить лишний storage I/O на телефоне без отказа от crash-safe atomic rename/file sync.

### 2.6 Архитектурная граница
Добавлен `CognitiveSubsystemFacade` как безопасная точка для новых интеграций. Это не переписывает `OrganismCore`, но позволяет начинать выход из monolith через стабильный API вместо новых прямых зависимостей.

## 3. Regression evidence

PASS:
- typecheck
- BIG_PASS_36 budget/evidence regression
- BIG_PASS_35 hardening
- P40 model ecology
- P41 truthfulness
- architecture
- release contract
- source hygiene
- full-project static audit
- operational hardening
- restart persistence (после fsync optimization)
- long-horizon operational 250

Последний operational-250 результат: `warmedMedianRatio=1.834`, `heapGrowth=1.035`, `firstMedianMs=140.75`, `lastMedianMs=258.21`, `p95Approx=290.71`. Это PASS существующего порога, но не идеальная стабильность; long-horizon остаётся активным направлением.

## 4. Важный отрицательный результат
Composite/длинные historical test campaigns нельзя считать полностью закрытыми. В прошлых проходах были timeout-риски `restart-persistence`/long-horizon; в 34.4.0 restart gate после persistence optimization уже проходит, но 24h/72h/7d/30d реальных device-run всё ещё не выполнены.

## 5. Контрольный checklist программы

### A. Phone Survival
[x] adaptive sensor schedule
[x] process CPU signal
[x] telemetry stale handling
[x] Termux API dependency
[x] model circuit breaker
[x] balanced persistence I/O
[ ] native Android lifecycle host
[ ] SoC thermal-zone telemetry
[ ] battery-aware model tier selection by measured device

Прогресс: **68%**

### B. Evidence / Prediction
[x] Prediction Ledger
[x] corrected prediction semantics
[x] prediction improvement metric
[x] Runtime Evidence Bus
[x] lineage integrity
[x] evidence persistence across restart
[x] P65 belief lifecycle
[ ] calibrated external-source hierarchy with independent corroboration
[ ] long-horizon prediction improvement benchmark

Прогресс: **76%**

### C. Cognitive Budget
[x] initial budget
[x] operation cost model
[x] runtime spend
[x] information gain accounting
[ ] shared cost model for all persistence/memory/research paths
[ ] device-calibrated cost coefficients

Прогресс: **78%**

### D. Model Ecology
[x] reliability
[x] cooldown/circuit breaker
[x] legacy-safe restore
[ ] measured Qwen mobile tiers
[ ] device-specific benchmark matrix
[ ] shadow/model Olympics

Прогресс: **72%**

### E. Memory
[x] persistent memory
[x] lifecycle/governor
[x] epistemic separation
[x] belief expiry/support lifecycle
[ ] predictive memory cache
[ ] model-memory separation benchmark

Прогресс: **75%**

### F. Learning
[x] P30 continual learning
[x] prediction improvement signal
[x] replay infrastructure
[ ] cross-domain transfer benchmark
[ ] failure→learning longitudinal benchmark

Прогресс: **66%**

### G. Agency / Goals
[x] autonomous cycles
[x] goal ecology
[x] self-projects
[ ] externally validated long projects
[ ] project-level skill acquisition benchmark

Прогресс: **69%**

### H. Reality Research
[x] P32/P38/P52/P57/P77 foundations
[x] evidence boundary
[ ] controlled intervention runner
[ ] replication/falsification loop
[ ] independent external trust hierarchy

Прогресс: **66%**

### I. Self / Identity
[x] self model
[x] identity continuity
[x] autobiographical layers
[ ] self-prediction benchmark
[ ] identity causal continuity benchmark
[ ] conflict-aware value model

Прогресс: **62%**

### J. Embodiment / Perception
[x] telemetry
[x] native audio/image features
[x] semantic interfaces
[ ] real vision backend
[ ] ASR/TTS benchmark
[ ] cross-modal grounding benchmark

Прогресс: **58%**

### K. Architecture Consolidation
[x] canonical/legacy separation
[x] facade boundary introduced
[ ] full OrganismCore decomposition
[ ] 7 stable subsystem APIs
[ ] remove duplicate P-layer control loops

Прогресс: **42%**

### L. Long-Horizon Reliability
[x] restart persistence
[x] checkpoints
[x] replay tools
[x] operational-250 benchmark
[ ] 24h
[ ] 72h
[ ] 7d
[ ] 30d

Прогресс: **58%**

### M. Consciousness Research
[x] functional model
[x] truthfulness constraints
[x] lesion tests
[x] temporal/embodied components
[ ] longitudinal corpus
[ ] independent evaluation
[ ] perturbation study

Прогресс: **45%**

## 6. Следование предыдущему плану

В этом проходе закрыты основные оставшиеся части BIG PASS 35 вокруг budget/evidence/prediction/persistence. Соответствие именно предыдущему report-checklist: **≈88% реализуемых пунктов прохода выполнено или усилено**. Оставшиеся **≈12%** относятся к native Android host, real vision/social cognition, long-horizon device evidence и полному decomposition.

Следование принципу «не добавлять функцию, если она снижает эффективность»: **PASS** — P41 тяжёлый вариант ранее был отклонён; persistence optimization после замера улучшена, а не оставлена в медленном состоянии.

## 7. Общий прогресс программы

Общая инженерная готовность: **61%**.
Это не показатель сознания. Это степень реализации архитектурных механизмов, эксплуатационной готовности, измеримости и evidence discipline.

Отдельно:
- mobile readiness: **68%**
- runtime robustness: **74%**
- persistence: **89%**
- test infrastructure: **84%**
- evidence quality: **76%**
- cognitive budget: **78%**
- memory architecture: **75%**
- learning: **66%**
- agency: **69%**
- reality grounding: **66%**
- perception: **58%**
- self/identity: **62%**
- social cognition: **40%**
- native Android lifecycle: **20%**
- architecture consolidation: **42%**
- long-horizon evidence: **58%**
- consciousness research readiness: **45%**

## 8. Следующий наиболее эффективный большой проход

**BIG PASS 37 — Evidence/Prediction Spine 3 + Autonomous Projects.**

Сфокусироваться на: external evidence trust hierarchy, true prediction improvement benchmark, self-prediction benchmark, project milestones/evidence quality, bounded project execution, и только затем начинать массовый OrganismCore decomposition.

## 9. Новые собственные архитектурные идеи-кандидаты

- Cognitive Quorum: критические решения проходят независимые self/world/memory/epistemic votes.
- Shadow Organism: неисполняющий альтернативный policy для сравнения решений.
- Model Olympics: несколько лёгких world models соревнуются на одном prediction stream.
- Cognitive Death: beliefs/policies могут быть формально сняты после систематической falsification.
- Dream Compiler: offline replay episodic memories → skills/hypotheses, но не facts.
- Information-Gain Economy: действие выбирается частично по ожидаемому снижению uncertainty.

