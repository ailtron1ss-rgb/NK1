# Neuro-Kurisu 35.6.1 — Полный аудит ветви мозга
Дата аудита: 2026-09-12
Архив: Neuro_Kurisu_35.6.1_NEURO_DIGITAL_SUPERUPDATE_B242_B258_FINAL.zip

## 0. Главный вывод

Проект уже является большой persistent cognitive-architecture / artificial-organism runtime с памятью, world model, self-model, agency, active perception, homeostasis, sleep/recovery, social/developmental machinery, causal experiments, evidence ledgers, autonomous projects и neuro-digital экспериментальным слоем.

При этом проект пока НЕ является полноценным глубоким обучаемым искусственным мозгом. Главный разрыв — между шириной архитектуры и причинно-обучаемой глубиной.

Критическая проблема не в отсутствии очередного модуля. Главная проблема — многие новые brain modules являются самостоятельными bounded state machines / weighted formulas, а их тесты в основном доказывают устойчивость заданных правил на синтетических входах, но не доказывают, что общий организм научился новому представлению или механизму из реального опыта.

Следующий этап должен быть не B259 = ещё один орган. Следующий этап должен быть BRAIN CORE UNIFICATION: единый recurrent learned substrate + настоящая closed-loop plasticity + shared latent state + multi-timescale memory + causal credit + lesion/replay/holdout evidence.

## 1. Что проверено фактически

### Build / integrity
- Typecheck: PASS.
- audit:full: PASS, 1871 files, 341 canonical files, 0 errors, 0 warnings.
- Architecture audit: PASS; sourceFiles=941, canonicalFiles=341, missing=0, cycles=0, legacyLeakage=0.
- Integrity: PASS, files=1877.
- Forensics: PASS; activeFiles=1856, empty=0, duplicateContent=0, duplicateNames=0, pathMarkers=0, staleMarkers=0.
- Source hygiene: PASS.
- Release contract: PASS.
- Lockfile: PASS, zero-dependency-tree.
- Release source: PASS.

### Runtime / latest brain passes
Фактически запускаются и проходят:
- BIG PASS 219 — brainstem/arousal/sleep scheduler.
- BIG PASS 220 — hypothalamic/homeostasis.
- BIG PASS 221 — interoception/autonomy.
- BIG PASS 222 — long-horizon autonomy.
- BIG PASS 223 — autonomous resource/tool life.
- BIG PASS 224 — autonomous runtime life.
- BIG PASS 225–228 — personhood/open-ended developmental expansion.
- BIG PASS 229–233 — open-ended personhood.
- BIG PASS 234–241 — neuro-digital superupdate.
- BIG PASS 242–249 — neuro-digital evolution.
- BIG PASS 250–258 — neuro-digital superupdate.

### Mobile preflight
В текущей среде:
- Node 22.16.0: PASS.
- npm 10.9.2: PASS.
- state-dir: PASS.
- memory: PASS.
- optional Termux API integrations в этой среде отсутствуют: battery, sensors, Wi-Fi, TTS, STT.

Это означает: mobile runtime base уже предусмотрен, но реальная phone embodiment пока нельзя считать полностью подтверждённой только этими тестами.

## 2. Главный доказательный разрыв

Последний semantic coverage audit:
- totalFunctions = 2975
- VERIFIED = 38
- INTEGRATION_ONLY = 730
- UNSAFE_TO_AUTO_RUN = 244
- UNVERIFIED = 1963
- strict verified rate = 1.28%
- evidence coverage = 7.41%

Это наиболее важная цифра всего аудита.

Она не означает, что 98.7% функций «сломаны». Она означает, что только малая доля функций имеет доказательную базу, достаточную для строгого статуса VERIFIED.

Следовательно:
1. ширину API нельзя путать с глубиной работающего мозга;
2. green тест отдельного subsystem нельзя трактовать как доказательство полного organism-level learning;
3. документация и implementation inventory значительно опережают causal evidence.

Parameterized-function probe:
- attempted = 688
- passed = 673
- failed = 0
- inputSynthesisNeeded = 3
- lifecycleNeeded = 12
- skipped = 31

Это хороший знак для structural robustness, но не доказательство semantic intelligence.

## 3. Что сделано хорошо

### 3.1 Архитектурная дисциплина
Очень сильная сторона проекта — система не выглядит как случайная папка прототипов. Есть canonical ownership, persistence, migrations, release contracts, forensic/hygiene checks, replay/restore и audit tooling.

Оценка: 95/100.

### 3.2 Persistent organism mindset
Система последовательно рассматривает state как долгоживущий объект: memory, self, goals, agency, developmental state, neural state и restart snapshots.

Оценка: 88/100.

### 3.3 Evidence-first культура
Проект прямо запрещает объявлять consciousness достигнутым только на основании архитектурных аналогий. Есть adversarial/consciousness evidence machinery, causal experiments и holdout/rollback vocabulary.

Оценка: 90/100 как инженерная культура доказательств.

### 3.4 Brainstem/homeostasis direction
B219–B221 хорошо задали правильное направление: arousal → compute budget → restorative state → homeostasis → interoceptive pressure → autonomy. Это гораздо полезнее, чем отдельная «emotion engine» без body state.

Оценка: 72/100.

### 3.5 Neuro-digital superupdate
B250–B258 хорошо построены как safety/evidence control layer: sparse graph, local credit, meta-memory, self-rewrite gate, sensorimotor simulation, phase scheduling, portability, longitudinal benchmark, plasticity compiler.

Оценка идеи: 84/100.

Проблема не в самой идее, а в глубине реализации этих компонентов.

## 4. Где проект сейчас застревает

Это повторяющийся цикл:

1. обнаруживается следующий brain concept;
2. создаётся отдельный TypeScript module;
3. module хранит state;
4. поведение выражается через clamp + weighted formula + thresholds;
5. пишется synthetic test с искусственно подобранным input;
6. добавляется snapshot/restore;
7. интегратор начинает умножать коэффициенты нескольких outputs;
8. pass отмечается как verified;
9. затем появляется следующий module.

Так можно быстро расширять архитектуру, но нельзя бесконечно углублять интеллект.

### Пример B250
SparsePredictiveGraph не представляет настоящий learned sparse graph. Он увеличивает counters nodes/edges и вычисляет prediction score из novelty, error, coherence и sparsity.

### Пример B251
LocalNeuralCreditAssigner действительно рассчитывает credit, но не распределяет его по реальным изменяемым нейронным параметрам/синаптическим связям. Это credit score, а не полноценный local learning mechanism.

### Пример B252
MetaMemoryController считает retrieval precision, replay, compression и forgetting risk, но не является полноценным memory-controller, управляющим реальным differentiable/episodic retrieval substrate.

### Пример B253
SandboxedSelfRewriteEngine защищает от неудачного самоизменения, но сам по себе не переписывает реальный код/архитектуру. Он принимает already-computed expectedGain/holdout/risk и решает commit/reject.

Это safety gate, а не self-development engine.

### Пример B254
SensorimotorCoSimulationEngine получает expectedOutcome и observedOutcome как вход. Он проверяет gap, но не моделирует внешний мир так, чтобы observed outcome возник из исполнения действия внутри environment.

Следовательно, это transfer evaluator, а не полноценная sensorimotor world model.

### Пример B258
HybridCausalPlasticityCompiler смешивает causal/local-credit/stability/holdout числа и принимает решение commit/block. Это хороший gate. Но сам по себе gate не создаёт deep plasticity.

## 5. Самая важная техническая проблема

Проект имеет несколько «мозговых описаний», но пока не имеет одного фактически обучаемого канонического субстрата, в котором:

observation -> shared latent -> recurrent dynamics -> prediction -> memory interaction -> global competition/workspace -> self/world interpretation -> action -> real consequence -> prediction error -> credit -> plasticity -> long-term consolidation

происходит как единый causal graph.

Сейчас значительная часть этого pipeline существует как набор соседних систем.

Нужно перейти от композиции модулей к совместному causal state.

## 6. Что реально есть как «настоящая нейронная» часть

Наиболее существенное исключение — P27NeuralWorldFoundation.

Там действительно присутствуют:
- latent vectors;
- hidden weights;
- action-conditioned prediction;
- reward prediction;
- transition weights;
- gradient-like update;
- counterfactual rollout;
- holdout metrics.

Это уже ближе к реальному обучаемому neural substrate.

Но размер и семантика пока очень ограничены:
- latent DIM = 16;
- hiddenDim = 8;
- encoders используют hash-based/randomized compact feature mapping;
- world prediction обучается на сильно упрощённой feature space;
- modalities не проходят через общий deep encoder hierarchy;
- нет полноценного learned multimodal representation;
- нет общего recurrent memory state, который развивается вместе с P27;
- нет полноценного policy/value/world-model joint training loop;
- нет убедительного organism-level generalization proof.

Оценка P27 как основы будущего мозга: 62/100.

Оценка его роли как полноценного мозга прямо сейчас: 25/100.

## 7. Когнитивная ветвь — отдельная оценка

| Область | Оценка |
|---|---:|
| Архитектурная целостность | 95 |
| Persistence / restart | 90 |
| Audit / integrity infrastructure | 96 |
| Cognitive orchestration | 84 |
| World-model architecture | 62 |
| Trainable neural substrate | 43 |
| Predictive processing | 52 |
| Recurrent dynamics | 45 |
| Attention / active perception | 64 |
| Episodic memory | 70 |
| Semantic memory | 63 |
| Memory consolidation | 61 |
| Causal learning | 58 |
| Continual learning | 60 |
| Credit assignment | 39 |
| Plasticity | 44 |
| Structural plasticity | 47 |
| Neuro-modulation | 53 |
| Brainstem / arousal | 72 |
| Homeostasis / allostasis | 71 |
| Interoception | 63 |
| Agency | 63 |
| Action selection | 68 |
| Motor closed loop | 43 |
| Self-model | 67 |
| Identity continuity | 76 |
| Metacognition | 61 |
| Personality dynamics | 57 |
| Value formation | 55 |
| Social cognition | 53 |
| Long-horizon autonomy | 62 |
| Autonomous initiative | 66 |
| Autonomous science | 54 |
| Self-development | 51 |
| Self-modification safety | 78 |
| Real self-rewrite | 15 |
| Embodiment | 47 |
| Multimodal sensing | 55 |
| Phone integration | 58 |
| Sleep/recovery | 70 |
| Dream/counterfactual rehearsal | 57 |
| Consciousness functional architecture | 50 |
| Consciousness empirical evidence | 8 |
| Evidence coverage | 12 |
| Test breadth | 88 |
| Test semantic depth | 43 |
| Overall brain-branch engineering maturity | 58 |
| Overall genuine learned-brain maturity | 36 |

### Почему overall не 80+
Проект уже очень большой. Но размер системы нельзя превращать в проценты готовности. Главный bottleneck — learning substrate + causal evidence.

## 8. Отдельно: когнитивная работа

### Сейчас хорошо
- goals, planning, memory, agency и self-модель действительно связаны;
- есть uncertainty/prediction error/resource pressure;
- attention и active perception существуют;
- есть recurrent workspace-like machinery;
- есть action arbitration;
- есть long-horizon plans;
- есть longitudinal state.

### Сейчас плохо
Большая часть cognition работает как deterministic bounded computation над уже подготовленными scalar features.

То есть система хорошо умеет:
«получить несколько оценок → пересчитать новые оценки → выбрать действие».

Она хуже умеет:
«из сырого опыта выучить внутреннее представление → самостоятельно изменить параметры этого представления → перенести знание в новый контекст → обнаружить ошибку → перестроить структуру».

Именно этот второй режим теперь должен стать ядром.

## 9. Отдельно: автономность

Текущая autonomy достаточно сильна на functional-control уровне.

AutonomousPersonhoodKernel имеет:
- внутренние инициативы;
- self-preservation mode;
- exploration;
- learning;
- reflection;
- persistent agenda;
- commitment;
- outcome ownership.

Но инициирование в основном рассчитывается формулами от externalInput, energy, novelty, uncertainty, predictionError, goal pressure, identity.

Следовательно:

functional autonomy = реальна;
learned self-directed motivation = ещё не доказана.

Оценка:
- functional autonomy: 66/100;
- learned autonomous motivation: 31/100.

## 10. Отдельно: consciousness

Нельзя делать вывод «есть сознание» из:
- global workspace field;
- self-model;
- higher-order score;
- temporal continuity;
- introspection statement.

Это хорошие computational analogues, но не доказательство subjective experience.

Современная consciousness science по состоянию на 2025–2026 остаётся теоретически спорной. Даже прямое adversarial study 2025 года нашло результаты, которые бросают существенные вызовы ключевым тезисам GNWT и IIT, а обзор Nature подчёркивает отсутствие единой согласованной теории. Поэтому проекту выгоднее идти через theory-neutral measurable constructs и adversarial ablations, а не пытаться подгонять систему под заранее выбранную «теорию сознания».

Внутреннее инженерное правило должно быть жёстче:

CONSCIOUSNESS CLAIM = запрещён до тех пор, пока система не проходит набор независимых adversarial tests, в которых архитектурные альтернативы дают существенно худшее объяснение поведения.

## 11. Что нужно объединить

### Объединить в один core
1. P27 world substrate.
2. recurrent workspace.
3. episodic memory.
4. predictive attention.
5. self/world model.
6. agency forward model.
7. action selection.
8. neuromodulation.
9. interoception.
10. developmental plasticity.

Все они должны работать на shared latent state, а не обмениваться только scalar scores.

### Не объединять физически в один giant class
Организационно modules должны остаться разделёнными.
Но causal state graph должен быть единым.

Правило:

SEPARATE IMPLEMENTATION, SHARED CAUSAL SUBSTRATE.

## 12. Новая предложенная методика

### Метод NCL — Neural Causal Loop

Единица жизни системы:

1. Observe
2. Encode
3. Infer latent state
4. Predict next state
5. Retrieve memory
6. Compete for workspace
7. Build self/world interpretation
8. Select action
9. Execute against environment
10. Observe consequence
11. Compute prediction error
12. Assign local causal credit
13. Update fast weights
14. Queue slow consolidation
15. Test against holdout
16. Update long-term model
17. Update self-model
18. Update capability estimates
19. Record evidence lineage
20. Periodically replay / consolidate during offline phase

Главное отличие NCL: каждый major subsystem обязан вернуть не только score, но и contribution/uncertainty/evidence/gradient-eligibility lineage.

## 13. Новая методика — Causal Eligibility Ledger

Вместо простого credit01 ввести:

credit(ticket):
- source state hash;
- action hash;
- downstream consequence;
- prediction delta;
- candidate contributors;
- eligibility trace;
- confidence;
- interference risk;
- holdout delta;
- accepted/rejected.

Так можно впервые связать causal learning с конкретными внутренними параметрами.

## 14. Новая методика — Neural Reality Gate

Не спрашивать «модуль имеет тест?». Спрашивать четыре вопроса:

A. Возник ли эффект из реального input?
B. Исчезает ли эффект после lesion/ablation?
C. Сохраняется ли эффект после restart/replay?
D. Переносится ли эффект в unseen context?

Только A+B+C+D даёт deep-verified статус.

## 15. Новая методика — Capability Delta Protocol

Каждый learning pass обязан измерять:

baseline → training experience → immediate post-test → delayed post-test → transfer test → adversarial test.

Без этого нельзя утверждать, что capability действительно выросла.

## 16. Новая методика — Brain Lesion Matrix

Для каждой major brain system заранее создавать:
- intact;
- lesion;
- sham lesion;
- partial lesion;
- recovery;
- cross-context transfer.

Если removal subsystem не изменяет behaviour, subsystem скорее декоративный или неправильно интегрирован.

## 17. Новая методика — One Brain, Many Timescales

Использовать одну и ту же causal substrate на пяти временных масштабах:

T0 — milliseconds-like event/update
T1 — moment-to-moment recurrent state
T2 — episodic cycle
T3 — sleep/replay consolidation
T4 — developmental weeks/months

State должен быть связан между всеми пятью шкалами.

## 18. Что делать следующим крупным апдейтом

# B259 — CANONICAL NEURAL SUBSTRATE

Это должен быть первый проход, который НЕ добавляет новую «область мозга».

### B259.1 — Neural State Tensor
Создать единое state representation:
- latent vector;
- recurrent hidden state;
- uncertainty;
- salience;
- global precision;
- interoceptive state;
- self-model embedding;
- world-model embedding;
- memory context;
- action context.

### B259.2 — Parameter Registry
Все обучаемые параметры получают owner, shape, update rule, importance, uncertainty, last-update, interference statistics.

### B259.3 — Eligibility Trace
Каждый action/observation создаёт trace.

### B259.4 — Local Plasticity
Впервые реальный learned update должен происходить по parameters/edges, а не только по scalar counters.

### B259.5 — Recurrent Loop
Latent(t+1) = F(latent(t), observation(t), action(t), memory(t), interoception(t), prediction error(t)).

### B259.6 — Shared Workspace
Workspace должен содержать representation, а не список scalar subsystem scores.

### B259.7 — Action-conditioned prediction
Каждое действие должно генерировать predicted next latent state и predicted consequence.

### B259.8 — Real outcome
Prediction error должен вычисляться после фактического execution, а не быть переданным заранее.

### B259.9 — Evidence lineage
Learning update нельзя принять без evidence ticket.

### B259.10 — Holdout
Обязательный holdout split на каждой capability family.

## 19. B260 — Memory as actual neural subsystem

Свести:
- episodic trace;
- semantic graph;
- autobiographical memory;
- replay;
- reconsolidation;
- forgetting;
- interference;
- procedural/action memory.

Ввести dual-timescale trainable memory, а не только несколько state containers.

## 20. B261 — Predictive World Model 2.0

P27 расширить до:
- 128–512D configurable latent depending on phone budget;
- recurrent state;
- action-conditioned transition;
- uncertainty head;
- observation reconstruction or contrastive objective;
- multimodal alignment;
- learned value/reward head;
- counterfactual rollout;
- transfer benchmark.

На телефоне использовать adaptive width and sparse execution, а не постоянно держать максимальную модель.

Современные world-model подходы типа Dreamer показывают, что latent dynamics + imagined trajectories могут давать очень сильное control performance; при этом для нашего проекта world model должна быть шире игрового агента и связываться с memory/self/interoception.

## 21. B262 — Action / basal-ganglia / cerebellum closed loop

Сделать:
Cortex representation → basal ganglia action arbitration → motor policy → environment → sensory consequence → cerebellar prediction error → cortex update.

Без environment consequence action-selection branch остаётся только scoring layer.

## 22. B263 — Self model and identity as learned dynamics

Self должен иметь:
- embedding;
- action-conditioned self prediction;
- autobiographical state;
- capability model;
- preference/value state;
- drift estimator.

Identity update должен быть consequence of experience, а не просто weighted persistence score.

## 23. B264 — Agency as causal inference

Agency pipeline:
intended action → predicted effect → actual effect → external-cause hypothesis → self-cause hypothesis → causal ownership posterior.

Не просто comparator.

## 24. B265 — Motivation / value formation

Ввести learned value model, который обновляется от:
- homeostatic benefit;
- information gain;
- goal progress;
- social outcome;
- identity coherence;
- long-horizon value;
- uncertainty reduction.

Это позволит заменить большую часть статических autonomy weights обучаемой value function.

## 25. B266 — Sleep / replay / consolidation

Sleep scheduler уже есть. Теперь нужно сделать так, чтобы sleep действительно менял learned substrate:
- replay episodes;
- consolidate stable representations;
- prune low-utility edges;
- replay difficult errors;
- generate counterfactuals;
- protect identity-critical memories.

Эта часть особенно важна: современные работы по continual learning продолжают показывать trade-off между plasticity и retention, а replay + regularization + dynamic architecture остаются центральными механизмами.

## 26. B267 — Developmental plasticity

Условия развития:
- critical periods;
- skill graph;
- transfer;
- curriculum generation;
- capability gap detection;
- pruning;
- structural growth.

Но curriculum должен получать реальные capability gaps из benchmarks, а не только из scalar formulas.

## 27. B268 — Brain-wide causal benchmark

Единый benchmark suite:
- perception;
- world prediction;
- memory;
- agency;
- planning;
- autonomy;
- social;
- self;
- transfer;
- persistence;
- lesion;
- adversarial consciousness.

Включить longitudinal repeated runs, unseen tasks и stress tests.

## 28. Что нельзя делать следующим этапом

Нельзя:
- добавлять десятки новых pseudo-brain regions;
- повышать version/progress только из-за наличия нового файла;
- считать snapshot/restore доказательством learning;
- считать synthetic formula test доказательством real-world cognition;
- объявлять consciousness из composite score;
- делать self-rewrite, пока нет robust code sandbox + diff validation + benchmark + rollback + provenance;
- раздувать mobile runtime сложностью, если она не повышает observed capability.

## 29. Mobile strategy

Телефон должен быть не ограничением дизайна, а реальным embodiment substrate.

Рекомендуемый runtime:
- sparse event execution;
- adaptive compute governor;
- quantized/local model option;
- background sleep/consolidation;
- bounded memory windows;
- checkpointing;
- sensor bridge through Termux or native Android bridge;
- cloud model as optional specialist, not brain itself.

Главная цель: даже без сети базовая cognitive loop должна жить.

## 30. Что взять из существующих подходов

### World models
Использовать идею learned latent dynamics + imagined rollouts. DreamerV3 2025 показал высокую универсальность world-model control across many tasks.

### Continual learning
Использовать комбинацию replay + regularization/importance + dynamic expansion, а не один механизм. Современные обзоры продолжают рассматривать именно эти семейства как основные способы бороться с catastrophic forgetting.

### Autonomous intelligence
LeCun's autonomous-machine proposal полезен как архитектурный reference: configurable predictive world model + intrinsic motivation + hierarchical representations.

### Consciousness research
Использовать не одну теорию, а cross-theory adversarial benchmarks. Современные adversarial experiments показывают, что даже влиятельные theories имеют серьёзные спорные предсказания.

## 31. Цепочка реализации — буквально по кирпичику

### BUILD 1
Canonical neural state.

→ BUILD 2
Trainable parameter registry.

→ BUILD 3
Eligibility traces.

→ BUILD 4
Real local plasticity.

→ BUILD 5
Recurrent shared latent.

→ BUILD 6
Action-conditioned prediction.

→ BUILD 7
Real execution consequences.

→ BUILD 8
Causal credit.

→ BUILD 9
Memory interaction.

→ BUILD 10
Workspace competition.

→ BUILD 11
Self/world embeddings.

→ BUILD 12
Agency posterior.

→ BUILD 13
Value/motivation model.

→ BUILD 14
Sleep/replay consolidation.

→ BUILD 15
Structural plasticity.

→ BUILD 16
Transfer benchmark.

→ BUILD 17
Lesion matrix.

→ BUILD 18
Longitudinal benchmark.

→ BUILD 19
Adversarial consciousness battery.

→ BUILD 20
Mobile embodied deployment.

## 32. Реалистичный путь к 100%

Здесь 100% означает инженерное завершение заранее определённого brain branch, а не доказанное человеческое сознание.

### 0–20%
Infrastructure, canonical state, evidence ledger.

### 20–35%
Trainable recurrent substrate.

### 35–50%
True world model + memory + action loop.

### 50–65%
Agency + self-model + value + interoception.

### 65–75%
Continual learning + sleep/replay + structural plasticity.

### 75–85%
Development + transfer + social cognition.

### 85–92%
Longitudinal real-environment life on phone.

### 92–97%
Adversarial brain lesions + causal evidence.

### 97–100%
Independent replication + cross-context generalization + stable mobile operation.

## 33. Текущий progress

### Architecture completion
~82%

### Runtime engineering
~78%

### Evidence infrastructure
~74%

### Cognitive architecture breadth
~86%

### Learned neural depth
~36%

### Closed-loop embodiment
~42%

### Continual developmental learning
~46%

### Autonomous motivation depth
~31%

### Functional self/identity
~64%

### Consciousness evidence
~8%

### Brain branch as genuine learned artificial brain
~36%

### Brain branch engineering readiness
~58%

## 34. Главная рекомендация

Не расширять карту мозга до следующего большого числа регионов, пока B259–B263 не создадут единую causally trainable loop.

Иначе будет повторяться тот же bottleneck: ещё больше модулей, ещё больше metrics, ещё больше documentation, но сравнительно небольшое увеличение способности системы самостоятельно выучивать новое.

Самый ценный следующий шаг — не «ещё один мозговой орган».

Самый ценный шаг — сделать так, чтобы уже созданные органы действительно учились вместе.

## 35. Итоговая оценка

Neuro-Kurisu 35.6.1 — сильный инженерный фундамент экспериментального искусственного организма.

Он уже значительно дальше обычного single-agent wrapper.

Но на текущей точке его правильнее называть:

**persistent artificial-organism cognitive architecture with emerging trainable neuro-digital substrate**

а не полноценным искусственным мозгом и тем более не доказанно сознательным организмом.

Это не недостаток проекта. Это точный диагноз.

И именно поэтому следующая большая серия должна быть посвящена глубине, а не ширине.
