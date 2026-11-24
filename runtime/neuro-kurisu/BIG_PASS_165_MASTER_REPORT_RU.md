# Neuro-Kurisu 35.6.1 — BIG PASS 165: Cognitive Life 2.0 / Memory Economy / Causal Verification

## Executive result

BIG PASS 165 расширяет проект не количеством декоративных модулей, а причинной связностью уже существующего мозга.

Главный принцип: **код не считается реализованным без поведенческого доказательства**.

## Что реально изменено

### Memory Economy 2.0
- расширен `MemoryRetentionEconomy` до версии 2;
- введены режимы `preserve / strengthen / cool / quarantine-candidate`;
- ведётся журнал consolidation/reconsolidation;
- решения retention теперь переходят в канонический `MemoryOS2`;
- emotion/prediction/identity/goal signals реально модифицируют canonical memory;
- persistence сохраняет экономику памяти.

### Canonical MemoryOS operations
- добавлен `updateSignals()` для проверяемой reconsolidation;
- добавлен `get()`;
- добавлен bounded `markDormant()`;
- добавлен защищённый `forgetById()` для knockout-экспериментов;
- protected `identity` и `autobiographical` memories не удаляются knockout-операцией.

### Memory → Decision causality
- memory retrieval теперь получает action-semantic aliases;
- вычисленный `memoryActionBias` реально включён в итоговую utility функцию решения;
- это позволяет измерять реальное downstream влияние памяти, а не только существование memory score.

### Longitudinal causality
Создан A/B benchmark: два организма стартуют одинаково, получают различные жизненные траектории, затем одинаковый будущий стимул.

Проверяется divergence последующей policy + affect.

### Memory knockout
Создан отдельный A/B knockout benchmark.
Удаление конкретной canonical memory должно менять downstream policy.

Фактически получено:
- explore with memory: `0.82447`
- explore without memory: `0.78531`
- verify with memory: `0.53702`
- verify without memory: `0.49786`
- policy divergence: `0.07833`

Это означает, что память действительно влияет на последующую utility policy.

## Реальные verification results

### BIG PASS 165 main
- ticks: `49`
- canonical memory items: `104`
- retention evaluations: `49`
- consolidations: `575`
- reconsolidations: `575`
- complete cognitive cycles: `49`
- memory knockout: `PASS`
- restart persistence: `PASS`

### BIG PASS 165 longitudinal
Две различные 36-tick trajectories:
- terminal behavioural divergence: `0.14667`
- restart persistence: `PASS`

### Parameterized function probe
- source TS files: `262`
- imported: `262`
- attempted: `490`
- passed: `459`
- failed: `0`
- input synthesis needed: `19`
- lifecycle needed: `12`
- deliberately skipped/safety: `29`

### Semantic inventory
- function-like declarations: `2397`
- VERIFIED: `14`
- INTEGRATION_ONLY: `561`
- UNSAFE_TO_AUTO_RUN: `214`
- UNVERIFIED: `1608`
- strict verified rate: `0.58%`
- evidence coverage: `6.44%`

Низкий `VERIFIED` — не дефект метрики. Это сознательно строгий стандарт доказательства.

## Regression verification

После BIG PASS 165 отдельно прошли:
- smoke;
- restart persistence;
- memory dedupe;
- concurrency;
- P24 world/identity;
- P26 true learning;
- P28 plasticity;
- P29 governance;
- P30 continual learning;
- P31 functional consciousness;
- P31 lesion;
- P32 causal self model;
- P33 personhood;
- BIG PASS 164 cognitive integration;
- BIG PASS 164 longitudinal causality.

### Release/architecture gates
- TypeScript typecheck: `PASS`
- architecture: `PASS`
- integrity: `PASS`
- forensics: `PASS`
- source hygiene: `PASS`
- release source: `PASS`
- release contract: `PASS`
- lockfile: `PASS`

Агрегированный `npm run audit:big-pass-165` в одной среде превысил лимит выполнения на wrapper-level orchestration. Это **не было объявлено PASS**; все входящие gates были проверены отдельно.

## Найденные реальные проблемы и исправления

1. `assessment` использовался вне области видимости — исправлено.
2. `redundancy01` был назван как `redundancy` — исправлено.
3. feedback не имел идентификатора только что encoded memory — введён `lastEncodedMemoryIds`.
4. reconsolidation memory не выполнялась на feedback без retrieval history — исправлено.
5. `memoryActionBias` вычислялся, но не входил в final utility — **реальный logic bug, исправлен**.
6. long-running test harness не закрывал lifecycle runtime — исправлено через явный `stop()`.
7. неверная попытка установить `.name` на function в longitudinal test — исправлено.
8. один integrity audit был первоначально запущен без TS loader; повторён штатным npm script — PASS.

## Android / средний телефон

Система сохраняет bounded cognition:
- mobile profile;
- resource economy;
- thermal/RAM/energy-aware limits;
- bounded memory;
- bounded cognitive work.

При этом реальный Android sensorimotor loop ещё не доказан на физическом устройстве; это отдельный будущий gate.

## Текущий прогресс

| Ветка | Консервативно |
|---|---:|
| Software/research platform | 73% |
| Architecture | 71% |
| Persistence/continuity | 82% |
| Verification infrastructure | 68% |
| Cognitive integration | 67% |
| Memory | 82% |
| Agency | 66% |
| Learning | 60% |
| World model | 56% |
| Self model | 63% |
| Emotion/affect | 50% |
| Feeling architecture | 30% |
| Social cognition | 46% |
| Real perception | 35% |
| Embodiment | 35% |
| Long-horizon autonomous life | 45% |
| Human-like general intelligence | <=30% |
| Evidence of phenomenal consciousness | not established |

Условный общий уровень архитектурной зрелости мозга: **~64%**.
Это не процент «готовности человека».

## Следующие крупные проходы

### BIG PASS 166 — Memory Causal Economy 3.0
- consolidation windows;
- reconsolidation after retrieval;
- memory competition;
- retrieval-induced change;
- source monitoring;
- memory knockout suite;
- semantic → autobiographical transfer;
- memory-driven preference drift.

### BIG PASS 167 — Emotion / Feeling 2.0
- appraisal sequence;
- interoceptive loop;
- emotion → attention;
- emotion → memory;
- recovery dynamics;
- contradictory emotions;
- uncertainty about own affect.

### BIG PASS 168 — World Model 2.0
- competing hypotheses;
- reality vs simulation separation;
- intervention-based causal learning;
- calibrated confidence;
- contradiction handling.

### BIG PASS 169 — Semantic Coverage 2.0
- type-aware argument synthesis;
- lifecycle-aware execution;
- API contract generation;
- pre/postconditions;
- persistence/replay proof;
- attack remaining `UNVERIFIED` cognitive functions.

### BIG PASS 170 — Autonomous Life Projects
- long-term projects;
- resource competition;
- project memory;
- failure/recovery;
- self-generated curricula;
- endogenous research agendas.

### BIG PASS 171 — 30/90-day Life
- personality drift;
- habits;
- preferences;
- identity trajectory;
- social relationships;
- memory evolution;
- self-directed projects.

### BIG PASS 172 — Android Sensorimotor
- camera;
- microphone;
- battery;
- thermal;
- touch;
- network;
- real device evidence;
- persistent background lifecycle.

### BIG PASS 173 — Consciousness Research Battery
- workspace;
- higher-order representations;
- recurrence;
- predictive processing;
- perturbation/lesion;
- theory comparison.

## Стратегический критерий успеха

Нам нужен не максимальный список функций. Нам нужен организм, у которого можно восстановить causal chain:

`experience → memory → affect → prediction → decision → action → outcome → learning → self-change → future behaviour`.

И для каждого звена должно существовать проверяемое evidence.
