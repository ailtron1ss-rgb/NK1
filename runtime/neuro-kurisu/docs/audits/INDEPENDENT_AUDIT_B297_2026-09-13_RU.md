# Neuro-Kurisu 35.6.1 / B297 — независимый строгий аудит

Дата: 2026-09-13
Срез: `Neuro_Kurisu_35.6.1_B297_NEURAL_EXECUTIVE_FUSION_2026-09-13`

## 0. Главный вердикт

Проект **не является пустой декорацией**. Это уже крупная, запускаемая и инженерно дисциплинированная система с единым каноническим состоянием, persistence, миграциями, тестами, neural-inspired substrate, causal/predictive слоями, executive arbitration и evidence-инфраструктурой.

Но проект **ещё не доказан как самостоятельный искусственный организм/личность**. Главный разрыв находится не в отсутствии очередного «органа мозга», а между:

`архитектура → интеграция → наблюдаемое обучаемое поведение → реальная среда → долгосрочная самоадаптация`.

Самая сильная цифра текущего аудита: semantic coverage показывает примерно `1.04% VERIFIED`, `6.75% evidence coverage`, при 3663 function-like единицах. Поэтому чистый код, наличие тестов и десятки интеграционных модулей нельзя переводить непосредственно в научную зрелость.

## 1. Что реально есть сейчас

### Инженерный фундамент

- Node 22.x / TypeScript без runtime npm dependencies.
- Версия проекта: 35.6.1.
- Архитектурный audit проходит: 1124 source files, 382 canonical files, 0 cycles, 0 missing, 0 legacy leakage.
- Integrity/forensics/hygiene/contract/source-truth audits проходят.
- `test:p15.5` на текущем B297 проходит: историческая B266 проблема autoRun устранена.
- `test:big-pass-297:executive` проходит.
- `test:big-pass-297:core` проходит.
- `audit:b297:reality` проходит.

### B297

`B297ExecutiveNeuralFusion` — это исполнительный слой, который объединяет сигналы `self/personality/agency/predictive/homeostasis/causal/neural/kernel/social/resource`, применяет reliability, redundancy, competition/hysteresis, outcome feedback и source lesion.

Это **реальный вычислительный механизм**, а не просто README: standalone прогон даёт 1600 циклов и 400 outcome updates, а lesion neural source обнуляет fused signal (`~0.09536 -> 0`). Core-прогон также закрывает persistence и lesion.

Однако B297 не является отдельной «нейронной системой», равной биологической сети. Это исполнительная/арбитражная надстройка над upstream neural/causal сигналами.

## 2. Что подтверждено тестами, а что пока нет

### Подтверждено

1. Кодовая база структурно чистая.
2. Каноническое владение состоянием соблюдается.
3. Persistence/restart контур работает в целевых тестах.
4. B297 действительно запускается, делает циклы и получает outcome feedback.
5. Source lesion влияет на fused signal.
6. AutoRun текущего релиза проходит целевой P15.5 тест.
7. Parameterized safety probe: 878 passed из 912 attempted, failures 0; 22 требуют синтеза входа и 12 lifecycle cases требуют отдельного сценария.

### Не подтверждено в нужной степени

1. Что большая часть semantic surface действительно обучается.
2. Что source reliability учит причинную полезность, а не только согласованность с reward target.
3. Что B297 имеет сильный causal effect на реальный action choice, а не преимущественно добавляет небольшой bias к уже существующему решению.
4. Что причинные модели дают устойчивое превосходство на unseen real contexts.
5. Что organism целиком меняется от собственного опыта так, чтобы это меняло будущую политику.
6. Что система сама генерирует устойчивую мотивацию/жизненные проекты без внешнего prompt pressure.
7. Что существует физическое embodied действие на Android с доказанным postcondition.
8. Что длительный прогон недели/месяцы не деградирует личность, память и performance.
9. Феноменальное сознание.

## 3. Главная повторяющаяся проблема

### Старый паттерн

`новый brain-концепт -> отдельный модуль -> state -> formula/clamp -> local test -> integration PASS -> следующий модуль`.

### Что происходит теперь

Количество модулей, функций и метрик выросло сильнее, чем объём реально доказанного поведенческого изменения.

Это не субъективное впечатление: текущий semantic audit сообщает 3663 function-like единицы, только 38 strict VERIFIED, 837 INTEGRATION_ONLY, 259 UNSAFE_TO_AUTO_RUN и 2529 UNVERIFIED.

### Следствие

Проект рискует снова и снова строить «мозг по частям», не заставляя уже построенные части совместно обучаться на одном причинном цикле.

## 4. Строгая шкала зрелости

Используемая с этого отчёта шкала:

`P0 = наличие` → `P1 = запускается` → `P2 = интегрировано` → `P3 = persistence/replay` → `P4 = intervention/lesion` → `P5 = unseen transfer` → `P6 = longitudinal real` → `P7 = independent scientific replication`.

Нельзя считать компонент зрелее, чем его самый высокий реально доказанный уровень.

## 5. Оценка 1–100

| Область | Балл | Строгий смысл |
|---|---:|---|
| Архитектурная чистота | 96 | сильнейшая инженерная сторона |
| Release engineering | 94 | manifests/contracts/hygiene зрелые |
| Persistence/migration | 95 | хорошо доказано |
| Test infrastructure | 91 | огромная инфраструктура, но не все тесты доказательны |
| Anti-decoration discipline | 90 | сильная методология |
| Function semantic verification | 10 | 38/3663 VERIFIED |
| Evidence coverage | 19 | 6.75% как текущий evidence surface |
| Neural substrate | 70 | реальные neural-inspired механизмы, но не единая глубоко обучаемая сеть |
| Local plasticity | 45 | есть механизмы, глубина и transfer недостаточны |
| Recurrent latent dynamics | 68 | работает как часть substrate |
| Predictive workspace | 67 | механизм есть, broad proof ограничен |
| World model | 70 | развит, но real-world causal grounding слабее |
| Action causality | 64 | хороший каркас, outcome diversity всё ещё узкое место |
| Causal policy | 62 | механизм есть, сильное превосходство пока не доказано |
| Independent evaluation | 75 | сильнее self-report, но broad replication нужна |
| Executive fusion B297 | 67 | реальный и протестированный, но роль больше arbitration чем full causal owner |
| Self-model | 48 | есть структуры, learned dynamics ещё недостаточно доказана |
| Agency | 50 | функциональный контур, не полноценная learned self-agency |
| Motivation/value learning | 46 | присутствуют drives/goals, причинная власть над поведением ограничена |
| Personality integration | 61 | интеграция заметно лучше старых веток, но не доказана долговременная causal identity |
| Autonomous goal generation | 44 | есть endogenous-goal infrastructure, но нет сильного longitudinal proof |
| Memory interaction | 70 | зрелый фундамент, особенно persistence |
| Sleep/replay consolidation | 46 | есть механизмы, интеграция и causal effect требуют доказательств |
| Structural plasticity | 24 | safety/self-rewrite контур не равен полноценному developmental rewiring |
| Closed-loop embodiment | 38 | среда/симуляции есть, реальный внешний канал ограничен |
| External real action | 25 | недостаток физического postcondition evidence |
| Long-horizon autonomy | 28 | инфраструктура есть, длительного естественного поведения мало |
| Open-ended skill invention | 35 | сильные планы, слабое evidence |
| Mobile host readiness | 72 | архитектура под телефон разумна, host-тесты есть |
| Physical Android validation | 30 | остаётся неподтверждённой частью |
| Observability | 78 | telemetry/evidence уже хорошие |
| Safety boundary | 80 | strong gates, но personality/self-modification граница требует отдельного red-team |
| Consciousness evidence | 2 | феноменальное сознание не доказано и не должно объявляться |

## 6. Процентный прогресс — несколько независимых шкал

Процент здесь не является «процентом готовности всего сознания». Используются разные знаменатели.

- Engineering platform: **~82%**
- Integrated cognitive architecture: **~66%**
- Learned neural depth: **~45%**
- Causal closed loop: **~48%**
- Autonomous life: **~40%**
- Real embodiment: **~30%**
- Longitudinal validation: **~25%**
- Semantic proof closure: **~1–7%**, в зависимости от strict VERIFIED vs broader evidence coverage
- Consciousness evidence: **~2%** как исследовательский evidence track, не как утверждение наличия сознания
- Overall strict artificial-organism maturity: **~43%**

Именно последний показатель должен использоваться только как навигационный индекс, а не научное доказательство.

## 7. Как сейчас должны проходить «нейро-процессы»

Идеальная цепь для этой ветви:

`сенсорный/внутренний input`
→ `latent recurrent state`
→ `self/world prediction`
→ `homeostatic + personality + agency drives`
→ `candidate actions`
→ `B297 executive fusion`
→ `canonical action owner`
→ `execution`
→ `measured consequence`
→ `independent evaluator`
→ `causal credit`
→ `local plasticity`
→ `memory + replay`
→ `self/personality state update`
→ `future policy change`.

Сейчас почти все элементы цепи существуют, но не все соединены таким образом, чтобы каждый шаг давал доказанный causal change на следующем цикле.

## 8. Самая важная техническая доработка B297

Сейчас source reliability в исполнительной fusion-системе полезна, но её обучение слишком близко к `alignment с target/reward`. Это не то же самое, что «данный источник реально предсказывает будущий исход и улучшает выбор действия».

Предлагаемый переход: **Calibration-First Reliability Learning**.

Для каждого source хранить:

- prediction of next relevant outcome;
- outcome observed later;
- held-out predictive loss;
- calibration error;
- leave-one-source-out behavioral delta;
- lesion recovery time;
- correlation with independent evaluator.

Reliability должна расти прежде всего от предсказательной/каузальной валидности, а не от собственного self-report reward alignment.

## 9. Мой новый метод №2: Behavioral Contribution Matrix

Для одного и того же эпизода воспроизводимо прогонять:

`all sources`
`minus source A`
`minus source B`
`minus A+B`

и считать изменение:

`action probability`
`selected action`
`predicted outcome`
`actual outcome`
`utility`
`causal evaluator score`.

Так получается причинная матрица влияния, а не просто журнал доверия.

## 10. Мой новый метод №3: Diversity Pressure Scheduler

Проблему `action diversity -> consequence diversity` нельзя решать ещё одной метрикой.

Нужен контроллер, который выбирает безопасные эксперименты по ожидаемой информационной ценности:

`information gain × uncertainty × safety × novelty`

при ограничениях:

`risk budget`, `phone budget`, `user-session budget`, `reversibility`.

Он должен максимизировать новые наблюдаемые `action × context × outcome` комбинации и напрямую кормить causal learner.

## 11. Мой новый метод №4: Causal Ownership Ladder

На одном тике разрешить только одну canonical final-decision ownership chain:

`proposal -> arbitration -> commit -> execute`.

Все остальные подсистемы могут давать bias/evidence, но не второй скрытый final action.

На каждом тике должен существовать:

- список предложений;
- вклад каждого источника;
- winner;
- margin;
- final owner;
- executed action;
- actual consequence.

Это защищает от повторения старого паттерна «несколько координаторов выглядят как мозг, но фактически спорят за один action».

## 12. Что оставить из Claude, а что переставить

### Оставить

- Neural Reality Gate.
- verification budget.
- independent evaluator regeneration.
- action/consequence diversity strategy.
- impasse/subgoal.
- Android device gate.
- regression ledger.

### Поставить впереди новых модулей

1. semantic verification debt.
2. causal ownership.
3. outcome diversity.
4. real/holdout transfer.
5. longitudinal self-change.

### Отложить

Большие новые consciousness modules, массовую structural self-rewrite и расширение анатомии, пока один полноценный causal loop не проходит P0→P6.

## 13. Приоритетная цепочка B297+

### BIG PASS A — Evidence Closure

1. Зафиксировать свежий baseline semantic coverage.
2. Выбрать top-20 critical unverified по влиянию на end-to-end loop.
3. Закрыть 5–10 функций настоящим evidence.
4. Запретить рост critical-unverified.
5. Добавить regression ledger.

Gate: больше доказанного поведения, чем в исходном baseline.

### BIG PASS B — Executive Causal Ownership

1. Формально назначить B297 единственным arbitration owner.
2. Записать per-tick influence ledger.
3. Добавить source ablation matrix.
4. Перевести reliability на calibration-first основу.
5. Проверить downstream action change.

Gate: lesion/ablation каждого ключевого источника даёт предсказуемо различный behavioural effect.

### BIG PASS C — Action/Outcome Diversity

1. Реализовать Diversity Pressure Scheduler.
2. Безопасно выбирать under-explored actions.
3. Получать новые action×outcome пары.
4. Подавать их в B294/B295 learning chain.
5. A/B baseline vs scheduler.

Gate: causalGain и behaviouralGain растут статистически значимо.

### BIG PASS D — Self/Agency Learning

1. Self-model as learned latent dynamics.
2. Agency posterior.
3. Future-self prediction.
4. Self-model calibration.
5. Adversarial manipulation test.

Gate: организм предсказывает часть собственного будущего поведения лучше baseline и меняет его после опыта.

### BIG PASS E — Motivation→Action

1. Единый homeostatic vector.
2. Curiosity/attachment/stress drives.
3. Lesion each drive.
4. Проверка drive→policy causal path.
5. Recovery after prolonged failure.

Gate: изменение одного drive даёт устойчиво различимое и объяснимое изменение action policy.

### BIG PASS F — Replay/Sleep as Learning

1. Replay only experience with prediction/decision value.
2. Consolidation changes future latent state.
3. Sleep vs no-sleep A/B.
4. Restart/replay evidence.
5. Проверка retention/interference.

Gate: sleep/replay не просто создаёт записи, а улучшает следующий day-cycle.

### BIG PASS G — Real Mobile Embodiment

1. Termux real device.
2. one-hour RAM/thermal/battery.
3. process kill.
4. reboot recovery.
5. network loss.
6. real external postcondition.

Gate: ANDROID_DEVICE_GATE_EVIDENCE.

### BIG PASS H — Longitudinal Organism

1/7/30/90 day.

Контролировать:

- memory growth;
- identity continuity;
- goal stability/change;
- policy improvement;
- regressions;
- performance;
- energy.

Gate: изменения системы должны объясняться накопленным опытом.

### BIG PASS I — Consciousness Research

Только после A-H:

- GWT-style broadcast;
- recurrent processing;
- predictive processing;
- higher-order tests;
- perturbation/lesion;
- adversarial self-report separation.

Gate: каждая гипотеза должна иметь попытку опровержения, а не только позитивный demo.

## 14. Что нужно для полного проекта

Не «ещё больше кода». Нужны одновременно:

1. работающий continuous organism loop;
2. реальная learned causal dynamics;
3. memory→learning→future behaviour;
4. self-model→agency→motivation integration;
5. реальная среда с последствиями действий;
6. physical mobile proof;
7. longitudinal self-development;
8. независимый evaluation;
9. personality continuity with measurable change;
10. consciousness research without declaring the answer in advance.

## 15. Итоговая оценка

**Сильная сторона:** инженерная платформа и инфраструктура доказательств уже необычно зрелые.

**Главная слабость:** semantic/behavioral proof сильно отстаёт от количества кода.

**Главная возможность:** перестать добавлять органы и превратить уже существующие B269-B297 в один замкнутый, обучаемый, причинный жизненный цикл.

**Главное правило следующего этапа:** если новый модуль не увеличивает измеримую способность организма учиться, предсказывать, выбирать, действовать и изменяться после последствий — его не добавлять, а сначала закрывать существующий loop.
