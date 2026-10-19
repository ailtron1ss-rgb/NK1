# P28 — Plasticity Substrate, Learning Governance & Project Gap Map

## Цель

P28 добавляет компактный низкоуровневый пластический слой под P26/P27. Он нужен для быстрых локальных ассоциаций, prototype-memory, eligibility traces и дешёвой привязки позднего результата к прошлой активности.

P28 также вводит две защитные идеи:

1. Недоверенные/подозрительные входы могут быть распознаны, но не получают права менять пластические прототипы и ассоциации.
2. Информационная ценность действия учитывается вместе со стоимостью действия; это слабый, но реальный первый шаг к Energy-to-Information Economy.

## Что реально реализовано

- bounded prototype memory: до 96 прототипов;
- 16-мерные нормализованные представления;
- модальные прототипы: text/vision/audio/sensor/world;
- онлайн-адаптация только для доверенных наблюдений;
- sparse eligibility traces с глобальным time-decay;
- post-outcome credit assignment;
- положительные и отрицательные локальные association weights;
- bounded association store до 768 записей;
- action binding между текущим состоянием и выбранным действием;
- learning provenance через source/trust/quarantine;
- diagnostics и API snapshot;
- schema migration 30 → 31;
- persistence через общий организм-state.

## Что P28 намеренно НЕ заявляет

- это не semantic vision;
- это не semantic audio;
- это не general-purpose neural network training;
- это не доказательство сознания;
- это не causal identification без внешнего вмешательства;
- это не доказательство долгосрочного улучшения на реальном POCO.

## Полная карта дефицитов проекта

### A. Восприятие — критичный дефицит

**A1. Настоящее semantic vision — отсутствует.**

Сейчас камеры/vision backend могут поставлять компактные признаки, но канонический runtime не содержит полноценного локального visual encoder/object-scene model.

**A2. Настоящее semantic audio — отсутствует.**

Есть низкоуровневые audio features, но нет устойчивого семантического audio/event representation.

**A3. Cross-modal temporal binding — частично.**

Есть shared latent и conflict score, но нет полноценной learned temporal multimodal state model.

### B. World model — частично реализован

**B1. Multi-step learned dynamics — отсутствует.**

Есть learned reward/context prediction и model-based counterfactuals, но нет устойчивого multi-step latent rollout с проверкой ошибок на held-out trajectories.

**B2. State reconstruction — частично.**

Нет отдельной модели, которая умеет восстанавливать полезную скрытую ситуацию из нескольких наблюдений.

**B3. Real intervention counterfactuals — отсутствуют.**

Текущие counterfactuals модельные; они не заменяют реальные control/treatment interventions.

### C. Learning — сильнее, но есть ключевые пробелы

**C1. P26 параметрическое обучение — есть.**

Оно реально меняет параметры и обобщает в пределах контролируемого feature/action space.

**C2. P28 быстрый локальный plasticity layer — есть.**

Он предназначен для low-latency association/prototype adaptation.

**C3. Hierarchical credit assignment — частично.**

Есть online update + replay + eligibility, но ещё нет единого hierarchical credit path через всё время жизни организма.

**C4. Continual-learning drift control — частично.**

Есть bounded stores, но пока нет полноценного оценки catastrophic forgetting на старых задачах.

**C5. Learning-to-learn/meta-learning — отсутствует.**

Организм пока не учится выбирать сам алгоритм обновления.

### D. Память

**D1. Memory thermodynamics — концепция есть, полноценного allocation engine нет.**

Нужен реальный бюджет:
information value / retrieval cost / storage cost / energy cost.

**D2. Cold/hot autobiographical storage — частично.**

Есть compression/capsules, но нет полного двухуровневого object store с graceful degradation.

### E. Identity

**E1. Long-lived identity — хорошая основа.**

**E2. Identity provenance graph — отсутствует в полном виде.**

Нужно хранить не только claim, но и lineage: какие experiences сделали claim сильнее/слабее.

**E3. Healthy adaptation vs identity drift — требует benchmark.**

### F. Autonomy

**F1. Internal goals — есть.**

**F2. Autonomous experiment generation — есть foundation.**

**F3. Autonomous research loop — ещё не замкнут.**

Не хватает полного цикла hypothesis → experiment → result → replication → self-update → verification.

### G. Safety / Governance

**G1. Input quarantine — P28 улучшает локальную защиту.**

**G2. Action authority graph — частично.**

Нужна строгая модель: кто может только говорить, кто может изменять state, кто может выполнять внешние действия.

**G3. Learning poisoning defense — частично.**

Нужны provenance-aware rollback и quarantine для подозрительных episodes, а не только для текущего input.

### H. Phone / Android

**H1. Runtime phone optimization — хорошая база.**

**H2. Real device endurance — не подтверждено.**

Нужны 24h / 72h / 168h / 30d campaigns.

**H3. Android lifecycle correctness — требует реального устройства.**

**H4. Local inference budget — зависит от конкретной модели GGUF и остаётся отдельным bottleneck.**

### I. Scientific validation

**I1. Holdout — есть.**

**I2. Ablation — есть.**

**I3. Controlled experiments — есть foundation.**

**I4. Blind external evaluator — ещё не автоматизирован полностью.**

**I5. Longitudinal evidence — отсутствует как завершённый физический gate.**

### J. Software architecture

**J1. Canonical boundary — хорошая.**

**J2. OrganismCore — всё ещё слишком большой.**

Нужен следующий крупный decomposition без изменения поведения.

**J3. Release automation — хорошая, но historical test suite остаётся долгим.**

### K. Resource economics

**K1. Battery-aware cognition — частично.**

**K2. Thermal-aware cognition — есть.**

**K3. Information-per-energy scheduling — только foundation.**

**K4. Storage wear budgeting — отсутствует.**

## Приоритеты

### Tier 0 — обязательно для следующего скачка

1. Real multi-step world model.
2. Semantic perception backends.
3. Unified hierarchical learning + credit assignment.
4. Longitudinal device evidence.
5. Learning poisoning/rollback for persisted episodes.

### Tier 1 — сильное улучшение качества

1. Identity provenance graph.
2. Memory thermodynamics.
3. Model ecology.
4. Multi-task continual-learning benchmark.
5. OrganismCore decomposition.

### Tier 2 — экспериментальные механизмы

1. Self-ablation campaigns.
2. Behavioral genome evolution.
3. Boredom-driven autonomous research.
4. Energy-to-information economy.
5. Cognitive weather/internal regime model.

## Рекомендуемая архитектура обучения

```text
Fast layer      : prototypes + eligibility + associations
Medium layer    : P26 parameter learning + P27 neural world
Replay layer    : episodic replay + counterfactual simulation
Development    : skills + identity + values + model selection
Scientific loop : baseline + holdout + ablation + longitudinal
```

Главный принцип: каждый слой должен иметь отдельную временную шкалу и независимый benchmark.
