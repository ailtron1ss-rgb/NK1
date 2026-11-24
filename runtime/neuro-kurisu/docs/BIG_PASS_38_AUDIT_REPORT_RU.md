# NEURO-KURISU 34.6.0 — BIG PASS 38
## Cognitive Spine 2: Prediction Debt + Quorum + Shadow + Long-Horizon + Autonomous Projects

Дата: 2026-09-05
База: **34.5.0 / BIG PASS 37**
Релиз: **34.6.0**
State schema: **84**

---

## 1. Цель

Этот проход не дублирует уже существующие Cognitive Budget, Evidence Bus, P65/P46 semantics, ExternalEvidenceTrust и базовый ModelOlympics.

Целью было замкнуть несколько контуров в единую lightweight cognitive spine:

```text
prediction
  ↓
prediction debt
  ↓
real outcome
  ↓
evidence quality
  ↓
quorum / shadow challenge
  ↓
project milestone
  ↓
skill promotion signal
  ↓
long-horizon learning
```

Для мобильного устройства приоритетом оставались bounded state, малый объём памяти и отсутствие обязательного вызова большой LLM.

---

## 2. Реально изменено

### 2.1 Prediction Debt
Добавлен `src/organism/system/PredictionDebt.ts`.

Есть состояния `open / aging / resolved / expired`, возраст, приоритет и lifecycle. При регистрации P46 prediction создаётся соответствующий debt, а `resolvePrediction` закрывает его по текущему organism tick.

### 2.2 Cognitive Quorum
Добавлен `CognitiveQuorum.ts`.

Решение может быть отклонено, если нет достаточного согласия между:
- constitution;
- world;
- memory;
- epistemic state;
- resources;
- identity;
- current goal.

Quorum не заменяет decision engine, а является bounded gate перед commitment.

### 2.3 Shadow Organism
Добавлен `ShadowOrganism.ts`.

Shadow выбирает альтернативу из уже сформированных кандидатов, но никогда не исполняется. После реального outcome сравнивается основной action с альтернативой и считается regret/divergence.

Это первая рабочая версия Shadow Organism. Это ещё не независимый полноценный второй интеллект.

### 2.4 Identity Causality Graph
Добавлен `IdentityCausalityGraph.ts`.

Фиксируется causal relation между событием/целью/памятью/value и identity node. Хранится bounded graph с лимитами по nodes/edges.

Это causal history layer, а не доказательство настоящей причинности личности.

### 2.5 Long-Horizon Prediction Benchmark
Добавлен `LongHorizonPredictionBenchmark.ts`.

Для organism-state prediction добавлены горизонты:
- 1 tick;
- 4 ticks;
- 12 ticks.

Каждый sample сохраняет prediction, actual outcome, error и improvement relative to baseline.

### 2.6 Autonomous Project Executor
Добавлен `AutonomousProjectExecutor.ts`.

Каждый self-project получает bounded 3-step execution plan:
1. observe/test/explore/respond;
2. independent repeat;
3. consolidation.

Executor отслеживает:
- attempts;
- successes;
- completed steps;
- validated steps;
- execution score;
- skill-promotion candidate;
- фактические procedural-skill promotions.

### 2.7 Project → Procedural Skill bridge
После outcome skill library обновляется первой. Затем executor получает факт, что конкретный action/context уже достиг habit-level promotion.

Это существенно лучше простого `skillGain01`, потому что проект теперь может оставить после себя реально promoted procedural behavior.

### 2.8 Runtime integration
Все новые состояния встроены в `OrganismCore`, persistence и `CognitiveSubsystemFacade`.

Runtime test подтверждает создание записей и их сохранение.

### 2.9 Release / audit tooling
Обновлены:
- state schema 84;
- release 34.6.0;
- VERSION / manifests;
- source-truth checks;
- BIG PASS progress audit;
- release documentation.

Сам progress auditor теперь содержит **39 машинных checks**.

---

## 3. Исправленные ошибки в процессе прохода

### 3.1 Неверная область видимости
При связывании executor с skill promotion была временная ошибка `actionWasRelevant` scope. Исправлено, executor теперь получает один outcome observation, без двойного инкремента.

### 3.2 Prediction Debt age
Исправлен расчёт resolve-time: используется текущий organism tick, а не условное поле resolvedAt.

### 3.3 AutonomousProjectExecutor score
Старый вариант использовал абсолютное расстояние `success - expected` как центральный сигнал. Это могло неадекватно оценивать сильный успешный результат. Формула заменена на bounded success/evidence signal.

### 3.4 Audit tool drift
Сам machine auditor содержал устаревшие regex для release и long-horizon. Исправлены контрольные выражения. После этого получено **39/39 PASS**.

---

## 4. Фактическая runtime-проверка

`BIG_PASS_38_AUTONOMOUS_SPINE=PASS`

На 20 ticks:
- prediction debt: **19**;
- quorum decisions: **17**;
- shadow comparisons: **17**;
- long-horizon samples: **34**;
- project executor cycles: **5**.

Migration:
`BIG_PASS_38_MIGRATION=PASS schema=84 release=34.6.0`

P80–P82:
`P80_P82_RUNTIME_E2E=PASS`

---

## 5. Regression evidence

PASS:
- TYPECHECK
- BIG PASS 38 spine
- P64/P65 integration
- P66/P68 integration
- P80–P82 runtime E2E
- P42–P44 full suite
- P54 long-horizon evidence
- P57 reality-first observatory
- P74–P77 integration
- runtime clocks
- server smoke
- API security
- server security smoke
- restart persistence
- memory dedup
- identity lock
- concurrency
- replay
- portable subject boundary
- architecture audit
- source truth
- forensics
- source hygiene
- release contract
- API routes
- subject boundary

---

## 6. Performance

Последний operational-250 этого pass:

```text
warmedMedianRatio = 1.722
firstMedianMs     = 153.29
lastMedianMs      = 264.01
p95ApproxMs       = 294.20
heapGrowth        = 1.835
```

P42–P44 isolated performance:

```text
cycles = 10000
ms     = 142.9
```

### Интерпретация

Компоненты остаются быстрыми, но bounded organism workload на длинной серии не идеален. По сравнению с предыдущим проходом overhead вырос.

Это означает:

> BIG PASS 38 улучшил функциональную связность быстрее, чем оптимизировал горячий путь.

Это **не считается провалом**, но это реальный следующий engineering target.

Следует не удалять новые cognitive mechanisms, а:
- batch/update only on meaningful events;
- decouple cold state from hot tick;
- reduce redundant snapshots;
- limit shadow/quorum/long-horizon frequency under low cognitive budget;
- reuse object allocations where safe;
- benchmark on actual Android hardware.

---

## 7. Что теперь действительно стало сильнее

### Prediction
Есть не только prediction record, но и lifecycle debt.

### Decision
Есть не только score, но и quorum + shadow challenge.

### Projects
Есть не только generated project, но и bounded execution.

### Skills
Есть не только skill gain, но и promotion bridge.

### Long horizon
Появились проверяемые горизонты 1/4/12.

### Identity
Появился causal graph для накопления причинно связанных identity events.

---

## 8. Что остаётся нерешённым

- полноценный independent learned world-model competition;
- fully independent Shadow Organism;
- real external live-source corroboration pipeline;
- project executor с реальными внешними инструментами/файлами/исследованиями;
- 24h/72h/7d/30d Android evidence;
- native Android lifecycle host;
- SoC thermal telemetry;
- real mobile vision backend;
- ASR/TTS benchmark;
- social prediction benchmark;
- full OrganismCore decomposition;
- seven stable subsystem APIs;
- removal of duplicate P-layer control loops;
- independent consciousness evaluation.

---

## 9. Прогресс

### Общий инженерный прогресс
**~68%**

Это не consciousness score.

### Следование предыдущему плану
**~98%** для пунктов, которые были запланированы и доступны для реализации в кодовой базе без физического Android-устройства.

### BIG PASS 38 checklist
**39/39 = 100%**

### Готовность аспектов

| Аспект | % |
|---|---:|
| Mobile readiness | 70 |
| Runtime robustness | 78 |
| Persistence | 90 |
| Evidence quality | 88 |
| Cognitive Budget | 82 |
| Learning | 71 |
| Agency | 77 |
| Reality grounding | 76 |
| Self / Identity | 70 |
| Project autonomy | 68 |
| Prediction infrastructure | 78 |
| Long-horizon | 62 |
| Architecture consolidation | 47 |
| Perception | 58 |
| Native Android lifecycle | 20 |
| Social cognition | 40 |
| Consciousness research readiness | 48 |

---

## 10. Методологические правила

- Internal score is not external truth.
- Confidence is not correctness.
- Simulation is not reality.
- Project generation is not project completion.
- Project completion is not skill acquisition.
- Skill acquisition is not general intelligence.
- Functional consciousness indicators are not phenomenal consciousness proof.
- A passing smoke test is not longitudinal evidence.

---

## 11. Следующий большой этап

Наиболее эффективным следующим проходом является не добавление новых P-модулей, а:

**BIG PASS 39 — Cognitive Spine Optimization + Real Project Executor + Shadow/Model Competition 2**

Приоритет:
1. убрать лишние hot-path snapshots;
2. budget-aware frequency scheduling новых subsystems;
3. довести project executor до реального bounded task execution;
4. добавить independent evidence sources;
5. сделать shadow более независимым от основной policy;
6. перевести ModelOlympics от strategy tournament к нескольким реально обучаемым predictors;
7. начать выделение первого самостоятельного stable subsystem API из OrganismCore.
