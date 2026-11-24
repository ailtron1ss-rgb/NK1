# NEURO-KURISU 34.5.0 — BIG PASS 37
## Evidence / Prediction Spine + Autonomous Project Grounding

Дата: 2026-09-05
Релиз: **34.5.0**
База: **34.4.0 / BIG PASS 36**

---

## 1. Цель прохода

Этот проход продолжает BIG PASS 36 и сознательно не повторяет уже внедрённые механизмы `CognitiveBudgetManager`, базовый `RuntimeEvidenceBus`, P46/P65 prediction semantics и первую `CognitiveSubsystemFacade`.

Главная цель: превратить существующие prediction/evidence/self-project механизмы в более проверяемую спину:

```text
prediction
   ↓
real outcome
   ↓
evidence quality
   ↓
self-prediction calibration
   ↓
model competition
   ↓
project milestone / skill progress
   ↓
longitudinal learning
```

Ключевой принцип: внутренний score не считается доказательством внешней реальности или сознания.

---

## 2. Что реально изменено

### 2.1 ExternalEvidenceTrust
Добавлен `src/organism/system/ExternalEvidenceTrust.ts`.

Разделены:
- класс источника;
- доверие источнику;
- confidence конкретного наблюдения;
- независимость источников;
- corroboration;
- contradictions;
- статус `candidate/corroborated/contested/expired`.

Это закрывает существенную часть старого TODO `external evidence corroboration hierarchy`.

Важно: simulator автоматически относится к низкодоверенному источнику и не считается external proof.

### 2.2 SelfPredictionBenchmark
Добавлен `src/organism/system/SelfPredictionBenchmark.ts`.

Теперь self-model имеет отдельный longitudinal benchmark:
- accuracy;
- Brier-like error;
- calibration gap;
- horizon buckets;
- recent errors;
- improvement vs chance.

Также исправлена старая ошибка `SelfModelV2`: calibration теперь сравнивает confidence с фактом правильности (`1 - mismatch`), а не с самим mismatch.

### 2.3 ModelOlympics
Добавлен `src/organism/system/ModelOlympics.ts`.

Это лёгкий prediction tournament. Несколько predictive strategies получают один и тот же outcome и сравниваются по accuracy/error.

Текущая версия является именно tournament substrate, а не доказанным набором независимых world models. Следующий этап — подключение настоящих learned world models.

### 2.4 Self-project milestones
`SelfProjectEngine` усилен:
- три milestone на проект;
- `validatedEvidenceCount`;
- `skillGain01`;
- progressive milestone completion;
- завершение проекта требует устойчивого evidence, а не только прогресса.

Это делает `authorshipScore` менее зависимым от простой генерации goal/project records.

### 2.5 Runtime integration
Новые системы встроены в `OrganismCore` и persistence:
- external evidence state;
- self-prediction benchmark;
- model tournament;
- restore/save;
- `CognitiveSubsystemFacade` exposes these views.

Runtime simulated environment явно передаёт `evidenceSource='simulator'`.

### 2.6 Release discipline
Версия поднята до **34.5.0**, обновлены source-of-truth и manifests.

---

## 3. Что показали тесты

### Новые тесты

`BIG_PASS_37_SPINE=PASS`
`BIG_PASS_37_RUNTIME_INTEGRATION=PASS`

В runtime integration на 80 циклах:
- self prediction samples: **79**;
- model tournament rounds: **80**;
- evidence records: **4** после bounded/corroborated aggregation;
- persistence после `flush/load`: PASS.

`P67_PROJECT_EVIDENCE=PASS`

Проект достиг:
- validated evidence >= 4;
- milestone completion;
- skill gain > 0.

### Regression

`TYPECHECK=PASS`
`P64_P65_INTEGRATION=PASS`
`P80_P82_RUNTIME_E2E=PASS`
`CLEAN_RESTART_PERSISTENCE=PASS`
`OPERATIONAL_HARDENING=PASS`
`CLEAN_ARCHITECTURE=PASS`
`RELEASE_CONTRACT=PASS`
`SOURCE_HYGIENE=PASS`
`FORENSICS=PASS`
`LOCKFILE=PASS`
`RELEASE_SOURCE=PASS`

### Performance

Последний `LONG_HORIZON_OPERATIONAL_250`:

```text
warmedMedianRatio = 1.671
firstMedianMs     = 129.14
lastMedianMs      = 215.85
p95ApproxMs       = 228.57
heapGrowth        = 0.530
```

Это лучше предыдущего наблюдения BIG PASS 36 и подтверждает, что оптимизация persistence и hot-path не ухудшила текущий bounded workload.

---

## 4. Что НЕ считаю закрытым

### 4.1 Long-horizon device evidence
Нет реальных непрерывных 24h / 72h / 7d / 30d прогонов на пользовательском Android.

### 4.2 Native Android lifecycle
Termux остаётся research/development host. Полноценный Android host/lifecycle ещё не реализован.

### 4.3 Real vision
P41 имеет sensor capture + lightweight features + semantic interfaces, но полноценный mobile vision backend ещё не подключён.

### 4.4 Social cognition
Социальный слой есть, но не имеет достаточно сильного independent prediction/evaluation benchmark.

### 4.5 Shadow Organism
Не реализован.

### 4.6 Full OrganismCore decomposition
Facade добавлена, но монолит всё ещё существует.

### 4.7 Truly empirical Model Olympics
Текущий P37 tournament сравнивает predictive strategies. Настоящее соревнование нескольких learned world models остаётся следующим уровнем.

### 4.8 Legacy autonomy gate
Существующий `test:autonomy` в этом проходе снова не завершился в общем 120-секундном окне. Это не классифицируется как PASS/FAIL функциональности организма; это отдельный operational/test-duration риск, который нужно разобрать.

---

## 5. Ключевой методологический результат

Главное изменение не в количестве классов, а в усилении distinction:

```text
internal confidence
≠
external evidence
```

и:

```text
predicted
≠
actual
≠
confidence
```

и:

```text
project created
≠
project validated
```

Это важная основа для будущей доказательной системы.

---

## 6. Прогресс программы

Общий инженерный прогресс: **~65%**.

Это показатель степени реализации архитектуры, evidence discipline и эксплуатационной готовности, а не consciousness score.

| Аспект | Прогресс |
|---|---:|
| Mobile readiness | 69% |
| Runtime robustness | 76% |
| Persistence | 90% |
| Test infrastructure | 85% |
| Evidence quality | 84% |
| Cognitive Budget | 79% |
| Memory architecture | 75% |
| Learning | 68% |
| Agency | 70% |
| Reality grounding | 73% |
| Perception | 58% |
| Self / Identity | 67% |
| Architecture consolidation | 45% |
| Long-horizon evidence | 58% |
| Native Android lifecycle | 20% |
| Social cognition | 40% |
| Consciousness research readiness | 46% |

Следование предыдущему отчёту: **≈94% реализуемых пунктов выполнено или существенно усилено**.

Машинный checklist BIG PASS 37: **30/30 = 100%**.

---

## 7. Архитектурные решения, которые сохранять

1. Не добавлять P-модули только ради роста номера.
2. Использовать P30 как predictive substrate, а не как отдельную изолированную фичу.
3. Считать external outcome более сильным сигналом, чем self-report.
4. Для мобильного устройства использовать tiered cognition вместо постоянного большого LLM.
5. Сохранять atomic persistence и возможность strict fsync.
6. Делать все новые subsystem integrations через stable facades/events.

---

## 8. Следующий большой проход

### BIG PASS 38 — Autonomous Projects + Model Competition 2

Приоритет:

1. Project executor: `proposal → milestone → action → evidence → validation → completion`.
2. Реально связывать project progress с procedural skill acquisition.
3. P30 prediction improvement benchmark на длинной серии.
4. Self-prediction benchmark с отдельными horizons 1/4/12 cycles.
5. Настоящий Model Olympics поверх нескольких world-model strategies.
6. Первичная версия Shadow Organism без права действия.
7. External evidence corroboration через несколько независимых источников.
8. Уменьшение количества duplicate control loops в `OrganismCore`.

После этого — BIG PASS 39: full OrganismCore decomposition + native Android lifecycle.

---

## 9. Новые собственные идеи для следующих проходов

### Cognitive Quorum
Критическое решение требует согласия нескольких внутренних подсистем: self/world/memory/epistemic/governance.

### Prediction Debt
Каждое нерешённое prediction скапливает долг; организм обязан либо проверить его, либо явно списать как устаревший.

### Evidence Market
Источники получают репутацию за долгосрочную предсказательную полезность, а не за субъективную доверительность.

### Identity Causality Graph
Не только память личности, а граф причин: какие прошлые события реально изменили будущую политику организма.

### Cognitive Opportunity Cost
Каждое действие сравнивается не только по utility, но и по упущенной возможности получить более ценную информацию.

---

## 10. Итог

BIG PASS 37 реально продвигает проект в сторону единого замкнутого цикла:

```text
predict
  → act
  → observe
  → verify evidence
  → compare alternatives
  → update self/world/project
  → try again
```

Система ещё не является доказанно сознательным или человеческого уровня разумом. Но gap между "много когнитивных модулей" и "одна система, измеряющая собственные прогнозы, реальные исходы и развитие" заметно уменьшен.
