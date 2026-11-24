# Neuro-Kurisu 34.15.0 — BIG PASS 45
## Cognitive Kernel Decomposition 3 + Mobile Performance Spine + Long-Horizon Stabilization

Дата: 2026-09-05
Статус: research-release

## 1. Governing baseline

Главным baseline для этого прохода является самый первый полный аудит проекта, выполненный до серии BIG PASS 35–44. Дополнительно сверены сохранённые crosswalk/checklist всех последующих проходов. Цель — не добавлять новые P-модули ради количества, а повышать реальную связанность, доказуемость, автономность и мобильную эффективность.

## 2. Главное, что реально изменено

### 2.1 P49 temporal token cache
`P49TemporalLifeEngine` получил bounded ephemeral cache токенов эпизодов. Повторный semantic overlap больше не должен заново нормализовать и токенизировать те же episode summaries. Cache перестраивается после restore/consolidation и обновляется при изменении summary.

### 2.2 Durability-aware integrity stamping
`IntegritySentinel.stamp()` теперь поддерживает `hash:false`. Во время hot/in-memory checkpoint выполняется invariant validation, но SHA-256 полного состояния откладывается до durable projection. Последний durable hash сохраняется до следующего физического сохранения. Для hash:true поведение осталось прежним.

### 2.3 Persistence budget fast path
`PersistenceBudgetController.decide()` больше не сериализует весь organism state только ради определения branch utilization. Полный `totalBytes` остаётся доступным в обычном report, а decision-path использует branch-only inspection.

### 2.4 Bounded governance history
`SelfGovernanceEngine` разделяет recent detail и longitudinal statistics. Recent governance records ограничены 160, consequence records — 192; cumulative counters сохраняют полную статистическую историю:
- totalRecords
- totalAutonomousDecisions
- totalOverrides
- totalConsequences
- totalRegret
- totalOwnership

Добавлен `snapshotLight()` для hot-path; полный snapshot используется на persistence boundary.

### 2.5 Bounded counterfactual history
P52 trajectory ограничена 160 samples, counterfactual history — 128. Общие calibration/sample counters сохраняются отдельно.

### 2.6 Eventual-consistency compatibility memory
Compatibility mirror больше не создаёт новую canonical MemoryOS запись на каждом tick без необходимости. При внешнем событии выполняется немедленное обновление; в спокойном состоянии — каждые 8 ticks. Canonical MemoryOS и основная identity/event history при этом продолжают работать постоянно.

Это важная mobile-оптимизация: compatibility projection является secondary compatibility layer, поэтому ему не требуется zero-lag обновление на каждом internal tick.

### 2.7 Hot-path no-clone contracts
P50 и P51 получили `clone:false`; OrganismCore использует их в местах, где возвращаемый snapshot не нужен. `MemoryOS2.encode()` также получил `clone:false`; в hot-path нужен только результат записи/дедупликации.

### 2.8 Operational advanced snapshot gating
В operational mode тяжёлые advanced snapshots больше не материализуются на каждом tick, если нет внешнего события. Периодическое обновление выполняется каждые 8 ticks или сразу при external signal. Full/non-operational путь остаётся полным.

### 2.9 Cognitive kernel boundaries
Продолжена физическая декомпозиция через:
- `CognitiveKernelCoordinator`;
- `CognitiveSubsystemFacade`;
- `CognitiveSubsystemPorts`.

Цель — постепенный выход из monolithic `OrganismCore` без потери единого state/event/prediction lineage.

### 2.10 1000-cycle stability gate
Добавлен официальный regression benchmark `test:long-horizon:operational:1000`.

Критерии:
- warm scaling < 5x;
- p95 < 120 ms;
- canonical memory <= 280 items.

Последний результат:
`ratio=2.094`
`firstWarmMs=18.59`
`lastMs=38.93`
`p95=44.27`
`heapFirst=48.03 MB`
`heapLast=79.98 MB`
`memory=224`

Это первый подтверждённый 1000-cycle operational milestone в текущем проекте.

## 3. Performance evidence

### 250 cycles
`warmedMedianRatio=1.568`
`firstMedianMs=17.20`
`lastMedianMs=26.98`
`p95Approx=28.69`
`heapGrowth=2.192`

### 500 cycles — warm
`warmedMedianRatio=1.727`
`firstMedianMs=21.26`
`lastMedianMs=36.71`
`p95=41.56`
`heapGrowth=1.028`

### 500 cycles — natural
`warmedMedianRatio=1.778`
`firstMedianMs=21.13`
`lastMedianMs=37.57`
`p95=39.98`
`heapGrowth=1.243`

### 1000 cycles
`warmedMedianRatio=2.094`
`firstWarmMs=18.59`
`lastMs=38.93`
`p95=44.27`
`heapFirst=48.03 MB`
`heapLast=79.98 MB`
`memory=224`

P42/P44 isolated benchmark:
`10000 cycles = 85.8 ms`.

Важно: ratios и абсолютные latency чувствительны к host/GC/JIT. Поэтому benchmark читается одновременно по ratio, absolute p95 и heap trend.

## 4. Why the long-horizon gain is real

До этого прохода canonical MemoryOS рос примерно по одному compatibility item на каждый tick. На 500 ticks это давало ~518 items. После eventual-consistency mirror на 500 ticks остаётся порядка 121 items в типичном operational profile; на 1000-cycle gate — 224, то есть остаётся bounded и сильно ниже прежней trajectory.

Также удалён полный SHA-256 расчёт на hot/in-memory checkpoint и сокращены лишние structuredClone. Эти изменения направлены на реальные hotspots профиля, а не на изменение test threshold.

## 5. Deliberate rollback

Ранее в серии проходов P30 independent batch prediction был протестирован и затем удалён, когда длинный runtime стал хуже. Аналогично более агрессивный cold-gating был откатан, когда benchmark ухудшился. Это соответствует принципу проекта: измеренный регресс важнее красивой архитектурной идеи.

## 6. Regression status

PASS:
- typecheck;
- organism smoke;
- P42/P44 performance;
- P64/P65 integration;
- P67 project evidence;
- P74/P77 integration;
- P80/P82 runtime E2E;
- restart persistence;
- integrity stamp options;
- governance retention + restore;
- project executor/evidence;
- API security;
- server security smoke;
- architecture;
- forensics;
- hygiene;
- source truth;
- release contract;
- release source;
- archive integrity;
- lockfile;
- 250/500 warm/500 natural/1000 operational benchmarks.

Не утверждается как PASS:
- 24h/72h/7d/30d реальная работа на Android устройстве;
- Native Android lifecycle host;
- реальные camera/VLM semantics;
- полноценный external tool ecosystem;
- полноценный social cognition benchmark;
- независимая проверка consciousness claims.

## 7. First-audit full recheck

Первая аудит-спецификация проверена снова. Текущий strict weighted implementation original actionable recommendations оценивается примерно в 86%.

### Полностью реализовано/усилено
- P40 model health/failure feedback;
- adaptive mobile scheduling;
- Evidence Bus;
- Prediction Ledger;
- evidence trust boundary;
- Cognitive Budget;
- simulator != reality;
- project milestones/evidence classes;
- autonomous project executor scaffolding;
- Cognitive Quorum;
- base Model Olympics + calibration;
- Cognitive Cache foundation;
- adaptive perception cadence;
- bounded persistence strategy;
- long-horizon 500/1000 operational gates;
- first physical Cognitive Kernel boundary;
- hot-path/cold-path runtime separation.

### Частично реализовано
- P30 general learning substrate;
- self-prediction as externally calibrated capability;
- causal research with true interventions;
- social cognition;
- multimodal perception;
- Shadow Organism independence;
- learned world-model competition;
- autonomous projects with real external world tasks;
- information-gain economy as full decision principle;
- dream compilation as safe knowledge pipeline;
- Cognitive Immune System as full independent subsystem;
- full Pareto/multi-objective identity pressure.

### Не реализовано/не доказано
- Native Android final lifecycle host;
- true semantic vision backend;
- real device ASR/TTS validation;
- 24h/72h/7d/30d autonomous phone evidence;
- independent consciousness evaluation;
- phenomenal consciousness evidence.

## 8. Architectural principle added in this pass

### Eventual-Consistency Cognition

Не все cognitive states требуют одинаковой temporal resolution.

Hot state:
- action choice;
- homeostasis;
- body;
- prediction;
- safety;
- goal pressure.

Warm state:
- evidence projection;
- compatibility memory;
- autobiographical updates.

Cold state:
- deep consolidation;
- dream/fork analysis;
- historical analytics;
- cryptographic durability proof.

Это позволяет одной и той же cognitive architecture существовать на разных time scales без лишнего расхода телефона.

## 9. Next large steps

### BIG PASS 46 — Cognitive Kernel Decomposition 4
Вынести реальные Self/World/Memory/Agency boundaries из `OrganismCore`.

### BIG PASS 47 — External Project Engine
Добавить реальные безопасные tool adapters и outcome validation.

### BIG PASS 48 — Shadow Organism 2 / Model Olympics 3
Разделить acting/shadow policy и сделать learned model competition.

### BIG PASS 49 — Native Android Host
Перевести lifecycle/sensors/camera/mic/power под native Android service architecture.

### BIG PASS 50 — Real multimodal perception
Camera/audio → semantic event graph → world/self model.

### BIG PASS 51+ — social mind + long-duration device experiments

## 10. Important interpretation

Текущий результат всё ещё нельзя называть доказанным сознанием. Система становится более автономной, устойчивой, predictive, evidence-aware и исторически непрерывной, но consciousness claim требует отдельной empirical evaluation.

