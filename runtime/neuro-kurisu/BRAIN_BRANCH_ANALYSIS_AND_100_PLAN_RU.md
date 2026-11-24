# NEURO-KURISU — ВЕТВЬ МОЗГА: ПОЛНЫЙ АНАЛИЗ И ПЛАН ДО 100%

## 1. Итог

Текущий Neuro-Kurisu уже имеет необычно широкий набор функциональных контуров, связанных с «мозгом»: память, world model, self model, identity, attention, workspace, metacognition, agency, interoception/homeostasis, emotion, learning, developmental systems, autonomous projects, social cognition, perception, embodiment и отдельную consciousness evidence battery.

Но архитектурная насыщенность сейчас заметно опережает глубину обучаемого нейронного субстрата.

Главный вывод:

**сейчас это сильная cognitive architecture / artificial-organism control system, но ещё не полноценное искусственное «мозговое ядро» в смысле глубокой обучаемой нейронной системы.**

Это принципиально важно. В текущем коде есть настоящие обучаемые компоненты: например, P27 содержит скрытый слой, веса, обучение по ошибке, action-conditioned prediction и counterfactual prediction; P26/P30 имеют параметрическое обучение. Однако большая часть высшего поведения всё ещё формируется вручную заданными формулами, порогами, weighted aggregation и state machines, а не обучаемой нейронной динамикой.

Поэтому дальнейший путь должен быть не «добавить ещё P82/P83/P84…», а:

**свести уже созданные когнитивные органы в единый обучаемый recurrent substrate → построить настоящие представления/память/предиктивные модели → замкнуть восприятие → внутреннее состояние → workspace → self/world model → действие → последствия → обучение → долговременную перестройку самого субстрата.**

Сознание при этом остаётся отдельной научной гипотезой. Наука не имеет общепринятой теории сознания, а GNWT, recurrent processing, higher-order и predictive-processing frameworks остаются конкурирующими и частично пересекающимися теориями. Поэтому 100% здесь означает **100% инженерной готовности ветви по заранее определённым проверяемым критериям**, а не доказанное феноменальное сознание.

---

## 2. Что показало исследование человеческого мозга

### 2.1 Не существует одного «центра сознания»

Современная литература описывает сознательный доступ как результат взаимодействия нескольких распределённых механизмов.

Global Neuronal Workspace связывает сознательный доступ с нелинейной ignition-подобной рекуррентной активностью и глобальной доступностью представления для множества специализированных подсистем. Recurrent Processing Theory подчёркивает необходимость рекуррентной обработки внутри и между уровнями сенсорной и ассоциативной коры. Higher-Order approaches добавляют представление о текущих психических состояниях на более высоком уровне. Современные обзоры прямо подчёркивают отсутствие единой подтверждённой теории сознания.

Следствие для Neuro-Kurisu:

**не строить один `ConsciousnessEngine`; строить динамическую систему взаимосвязанных механизмов, каждый из которых имеет отдельные causal tests.**

Sources:
1. Dehaene et al., “Conscious Processing and the Global Neuronal Workspace Hypothesis”, 2020.
2. Lamme & Roelfsema, “The distinct modes of vision offered by feedforward and recurrent processing”, 2000.
3. Lau & Rosenthal, “Empirical support for higher-order theories of conscious awareness”, 2011.
4. “Theories of consciousness”, Nature Reviews Neuroscience, 2022.
5. “Unpacking the complexities of consciousness: Theories and reflections”, 2025.

### 2.2 Мозг — рекуррентная система, а не последовательность независимых функций

В зрении и других формах cognition важна не просто цепочка input → output, а feedback/re-entry между уровнями.

Для проекта это означает, что `perception`, `world model`, `memory`, `workspace`, `self model` и `action` должны непрерывно корректировать друг друга.

Не:

`input → classifier → response`

а:

`input → latent state → prediction → mismatch → recurrence → global availability → self/world interpretation → action → predicted consequence → observed consequence → weight/state update → next latent state`.

Источник: Lamme & Roelfsema; global workspace literature.

### 2.3 Память человека — несколько взаимодействующих систем

Hippocampal/medial-temporal mechanisms быстро связывают события в episodic representations, тогда как distributed cortical representations медленнее интегрируют статистические закономерности. Это классическая идея Complementary Learning Systems, которая остаётся полезной и сегодня.

Важная современная деталь: память не просто «переносится из hippocampus в cortex» как файл. Исследования подчёркивают ongoing reorganization, replay, reconsolidation и изменение структуры представления со временем.

Следствие:

Neuro-Kurisu нужен не один persistent memory store, а действительно разные computational timescales:

- быстрый episodic trace;
- replay/reconstruction;
- semantic/statistical learning;
- procedural/action memory;
- autobiographical continuity;
- reconsolidation;
- protected/high-value long-term structure.

Sources:
- McClelland, McNaughton & O’Reilly, 1995.
- Kumaran, Hassabis & McClelland, 2016.
- Foster, “Replay Comes of Age”, 2017.
- Takehara-Nishiuchi, “Neurobiology of systems memory consolidation”, 2021.
- Singh & Schapiro, “Evidence for complementary learning systems within the hippocampus”, 2026.

### 2.4 Будущее строится из памяти и модели мира

Hippocampal systems участвуют не только в воспоминании, но и в конструктивной симуляции будущих событий, навигации и prospective cognition.

Следствие:

future simulation не должен быть текстовым «модулем фантазии». Он должен быть action-conditioned latent rollout, использующим learned representations и возвращающимся в decision loop.

Sources:
- Addis & Schacter.
- Schacter & Addis.
- Bendor & Spiers.
- Ha & Schmidhuber, World Models.
- DreamerV3.

### 2.5 Self — тоже модель, а не статическая строка identity

Default Mode Network участвует в self-related processing, autobiographical memory, prospection, theory of mind и internally generated thought. Современные обзоры всё больше рассматривают DMN как интегратор внешних данных с внутренними prior representations и контекстом.

Следствие:

`Identity` в Neuro-Kurisu должна быть persistent learned dynamical model:

`self-state(t) → prediction of self(t+1) → action → consequence → self-model error → revision`.

Не просто `identity01`.

Sources:
- Buckner / Andrews-Hanna / Spreng.
- Menon, “20 years of the default mode network”, 2023.
- Yeshurun et al., 2021.

### 2.6 Agency требует больше, чем comparator

Forward models и corollary discharge помогают связывать действия с предсказанными последствиями. Но исследования agency прямо предупреждают: простое совпадение prediction и observation недостаточно для полноценной модели agency.

Нужны как минимум:

- intended action;
- predicted consequence;
- execution;
- sensory consequence;
- causal ownership attribution;
- alternative external-cause hypothesis;
- uncertainty;
- revision.

Sources:
- Synofzik, Vosgerau & Newen, 2008.
- Zaadnoordijk et al., 2019.
- Welniarz, Worbe & Gallea, 2021.
- Thakkar et al., corollary-discharge literature.

### 2.7 Homeostasis должна быть predictive и allostatic

Интероцепция связана не только с «датчиками тела». Active interoceptive inference описывает regulation через generative predictions of internal states. Allostasis подчёркивает predictive regulation, а не только feedback correction.

Следствие:

P66 полезен как текущий control layer, но дальнейший brain branch должен перейти от:

`threshold + weighted error → mode`

к:

`latent internal state → prediction → sensed state → prediction error → policy/regulation → future internal state prediction`.

Sources:
- Seth & Friston, 2016.
- Sterling, 2012.

---

## 3. Что дают современные нейросети

### 3.1 Transformer — полезен, но не должен стать всем мозгом

Transformer доказал мощность attention-based sequence processing, но сам по себе не решает continual life, persistent subjectivity, embodiment, long-term homeostasis и автономную causal learning loop.

В Neuro-Kurisu transformer-подобная модель может быть specialist module, но не единственным brain substrate.

Source:
- Vaswani et al., “Attention Is All You Need”, 2017.

### 3.2 World models

World Models и Dreamer показывают, что агент может учить latent dynamics и планировать через imagined rollouts.

Это очень близко к требуемому внутреннему мозгу:

`observation → latent state → dynamics model → imagined future → policy`.

Но для Neuro-Kurisu нужно сделать это шире: world model должна быть связана с memory, self model, interoception, social model и action consequences, а не быть только environment predictor.

Sources:
- Ha & Schmidhuber, 2018.
- Hafner et al., DreamerV3, 2023.

### 3.3 Continual learning

Катастрофическое забывание — центральная проблема для искусственного организма, который должен существовать месяцами и годами.

Experience replay, synaptic intelligence и CLS-подобные подходы показывают разные способы удерживать старое знание при адаптации.

Для Neuro-Kurisu это должно стать частью самого learning substrate, а не отдельным «repair patch».

Sources:
- Rolnick et al., Experience Replay for Continual Learning.
- Zenke, Poole & Ganguli, Synaptic Intelligence.
- McClelland et al., CLS.

### 3.4 Автономный агент должен учиться сам формулировать, что ему исследовать

LeCun's autonomous-machine proposal особенно важен именно здесь: configurable world model + intrinsic motivation + hierarchical representations + planning.

Это совпадает с направлением Neuro-Kurisu, но проект должен реализовать это как реальную causal learning loop, а не набор эвристик.

Source:
- LeCun, “A Path Towards Autonomous Machine Intelligence”, 2022.

---

# 4. Что реально есть в текущем архиве

Архив содержит **269 исходных файлов**, относящихся к актуальному runtime branch по текущему аудиту; в проекте всего около **2493–2494 анализируемых функций**, в зависимости от конкретного аудита.

В brain branch найдено большое количество реальных computational organs.

## 4.1 Уже сильные области

### Cognitive substrate / integration

Есть:

- `CognitiveKernelCoordinator`
- `P61IntegratedMindKernel`
- `P64IntegratedOrganismDynamics`
- `UnifiedCognitiveCycle`
- `UnifiedCognitiveSubstrate`
- `CognitiveNetworkBus`
- `CognitiveField`
- `CognitiveBudgetManager`
- `CognitiveSpineScheduler`

Это уже ближе к центральной нервной системе, чем к chatbot wrapper.

### Conscious-access machinery

Есть:

- `P31FunctionalConsciousness`
- `RecurrentWorkspaceV2`
- `WorkspaceIgnitionMetrics`
- `MetaCognitiveMonitor`
- `ConsciousnessEvidenceLedger`
- lesion tests
- grounded introspection
- temporal moment continuity.

Это хороший research substrate.

### Memory

Есть:

- `MemoryFabric`
- `MemoryOS2`
- `MultiTimescaleMemory`
- `AutobiographicalMemory`
- `SemanticMemoryGraph`
- `ExperienceContinuumFabric`
- `P62MemoryFabric`
- memory lifecycle / consolidation / reconsolidation subsystems.

Архитектурно это одна из самых развитых частей проекта.

### World/self/agency

Есть:

- `P27NeuralWorldFoundation`
- `WorldModel2`
- `LearnedResidualWorldModel`
- `WorldModelEnsembleController`
- `P44EmbodiedPredictiveSelfWorld`
- `P50CausalSelfWorldEngine`
- `P80UnifiedSelfState`
- `P32CausalSelfModel`
- `SelfAuthorship`
- `IdentityTrajectoryEngine`
- `FutureSelfModel`
- `P33/P34 Personhood`
- `AgencyDeliberationEngine`
- autonomous project engines.

### Interoception / emotion

Есть:

- `P66InteroceptiveHomeostasis`
- `EmotionAppraisalEngine`
- neuromodulation
- resource economy
- recovery debt
- body-energy coupling.

### Perception / embodiment

Есть:

- P37 sensorium
- P41 perception
- P42 experience representation
- P43 workspace imagery
- P44 predictive world
- Android telemetry
- camera/audio paths
- sensorimotor loop.

---

# 5. Что уже реально проверено в архиве

Я отдельно прогнал актуальный снимок.

### PASS

- TypeScript typecheck: PASS.
- BIG PASS 172 emotion/interoception: PASS.
- BIG PASS 173 world model: PASS.
- BIG PASS 174 world tickets/reality: PASS.
- BIG PASS 175 autonomous project life: PASS.
- project recovery: PASS.
- project scheduler: PASS.
- BIG PASS 177 Android contract: PASS.
- BIG PASS 177 embodiment causality: PASS.
- BIG PASS 177 device truthfulness: PASS.
- BIG PASS 178 compound adversarial: PASS.
- BIG PASS 178 core adversarial: PASS.
- BIG PASS 179 consciousness battery: PASS.
- BIG PASS 179 causal evidence: PASS.
- BIG PASS 180 lifecycle closure: PASS.
- BIG PASS 180 reproducibility: PASS.
- BIG PASS 181 function-reality closure: при первом запуске был 195/196, но повторный запуск дал 196/196.

### Важный найденный дефект

`OutcomeCognitionFabric` / `CausalAccountabilityGraph` содержит nondeterministic snapshot behavior.

`CausalAccountabilityGraph.snapshot()` записывает:

`lastAt: Date.now()`

а `restore()` не восстанавливает этот timestamp.

Поэтому byte-for-byte lifecycle closure иногда ломается только из-за миллисекундного рассогласования времени.

Это не косметика.

**Это реальный reproducibility defect.**

Его надо исправить на уровне архитектуры:

- persisted timestamps должны быть semantic state;
- runtime observation time должен быть отделён от persisted revision time;
- snapshot должен быть deterministic;
- тесты не должны «специально удалять lastAt» для прохождения.

---

# 6. Главная архитектурная проблема текущего мозга

## 6.1 Слишком много scalar heuristics

Во многих центральных узлах присутствует схема:

`a*signal1 + b*signal2 + c*signal3 ...`

с последующим `clamp`.

Это полезно как control engineering, но недостаточно как learned brain.

Примеры такого характера:

- P66 homeostasis;
- P80 unified self state;
- P81 attention;
- ActiveInferenceEngine;
- P58 cognitive kernel;
- large parts of agency arbitration;
- developmental gating;
- parts of workspace selection.

Это делает поведение определённым и тестируемым, но ограничивает emergent learning.

### Следствие

Не надо выбрасывать эти модули.

Нужно изменить их роль:

**сейчас они decision engines; впоследствии они должны стать priors / constraints / observability layers поверх обучаемого substrate.**

---

# 7. Вторая проблема: «нейронный» P27 всё ещё очень маленький

P27 действительно содержит:

- hidden layer;
- trainable weights;
- action-conditioned prediction;
- learned reward prediction;
- transition model;
- counterfactuals;
- holdout metrics.

Это настоящая обучаемая модель.

Но:

- representation dimension всего 16;
- input encoding в основном hash-based / handcrafted;
- нет learned multimodal encoder;
- нет полноценного recurrent latent state;
- нет глубокого temporal memory;
- нет learned attention over episodes;
- нет true sequence-level representation learning;
- нет rich predictive generative model;
- нет long-horizon world representation comparable to human episodic-semantic abstraction.

То есть P27 — **реальный seed**, но пока не neural brain.

---

# 8. Третья проблема: workspace пока функциональный, не neural-dynamical

`RecurrentWorkspaceV2` действительно имеет:

- competition;
- coalition;
- recurrence;
- broadcast;
- ignition;
- source diversity.

Это правильно как computational hypothesis.

Но пока это в основном deterministic state computation.

Для более сильной brain branch нужно перейти к:

- recurrent latent populations;
- learned competition;
- sustained activity;
- content-addressable routing;
- transient + persistent states;
- action-dependent gating;
- global broadcast into specialist networks;
- perturbation tests on internal representations.

То есть оставить API workspace, но поменять его internal substrate.

---

# 9. Четвёртая проблема: self model слишком агрегированный

`P80UnifiedSelfState` полезен как unified observable state.

Но:

`continuity01`
`coherence01`
`agency01`
`realityAlignment01`

не должны оставаться конечной моделью «я».

Это должны быть readouts из более богатого learned self-model.

Целевая форма:

`self latent(t)`

с компонентами:

- body state;
- internal needs;
- autobiographical context;
- current goals;
- social relations;
- capability beliefs;
- action tendencies;
- prediction of own next state;
- counterfactual self;
- identity constraints;
- uncertainty over self-model.

---

# 10. Пятая проблема: active inference пока heuristic approximation

Текущий `ActiveInferenceEngine` полезен как action scoring mechanism, но математически это не полноценный hierarchical variational active-inference implementation.

Внутри используется ручная смесь:

- uncertainty;
- pragmatic score;
- epistemic score;
- risk;
- action cost.

Это рабочий control approximation, но нельзя называть его полноценным brain-level free-energy engine.

Правильное развитие:

1. probabilistic latent state;
2. generative transition model;
3. state posterior;
4. prediction error;
5. epistemic value;
6. pragmatic value;
7. action-conditioned state prediction;
8. belief update;
9. hierarchical temporal scale.

---

# 11. Шестая проблема: автономность пока сильнее как lifecycle automation, чем как self-originating cognition

Тесты autonomous projects действительно работают.

Но автономный project scheduler ≠ autonomous mind.

Для искусственного организма нужно:

`internal state → unresolved tension → hypothesis → simulation → candidate goal → self-prioritization → action → environment → surprise → learning → goal revision`

Причём цикл должен запускаться без user prompt и сохраняться неделями.

---

# 12. Седьмая проблема: long-horizon ещё не закрыт

500-cycle и более длинные тесты важны.

В текущем окружении extended operational test на 500 циклов превысил отведённый лимит выполнения, поэтому его нельзя засчитать как полный текущий PASS.

Это означает:

- короткие causal loops работают;
- долгоживущая brain dynamics ещё не сертифицирована;
- memory growth / heap thermodynamics остаются критическим gate.

---

# 13. Реальная оценка состояния brain branch

Это **моя инженерная оценка**, а не metric, уже утверждённый проектом.

| Подсистема | Реальное состояние |
|---|---:|
| Canonical cognitive integration | 70% |
| Memory architecture | 62% |
| World model | 45% |
| Self model | 50% |
| Identity continuity | 60% |
| Agency | 50% |
| Learning substrate | 42% |
| Continual learning | 40% |
| Attention | 50% |
| Recurrent workspace | 48% |
| Metacognition | 50% |
| Interoception/homeostasis | 45% |
| Emotion/affect coupling | 44% |
| Perception | 38% |
| Sensorimotor embodiment | 35% |
| Autonomous life | 34% |
| Social cognition | 35% |
| Neural substrate depth | 25% |
| Conscious-access research substrate | 40% |
| Phenomenal consciousness evidence | 0% proven |

### Моя общая оценка branch

**≈ 46–50%**

Почему не 58.8% project-wide:

проект в целом имеет много engineering infrastructure, persistence, governance и lifecycle machinery, но именно **мозговая глубина** ещё недостаточна.

---

# 14. Цель 100%

100% brain branch означает:

## A. Neural substrate

- learned multimodal representations;
- recurrent latent dynamics;
- hierarchical temporal processing;
- predictive coding / error channels;
- learned attention;
- learned gating;
- persistent state;
- plasticity;
- protected knowledge;
- replay;
- consolidation;
- model revision.

## B. Memory

- rapid episodic encoding;
- semantic integration;
- procedural skill memory;
- autobiographical memory;
- replay;
- reconsolidation;
- memory competition;
- forgetting;
- importance protection;
- causal provenance.

## C. Self

- learned body/self latent;
- temporal self prediction;
- autobiographical self;
- agency attribution;
- ownership attribution;
- identity trajectory;
- self uncertainty;
- self revision.

## D. World

- multimodal latent world;
- causal transitions;
- counterfactual simulation;
- long-horizon rollout;
- uncertainty;
- social world;
- environment learning.

## E. Conscious-access substrate

- recurrent competition;
- workspace ignition;
- broadcast;
- persistence;
- higher-order model;
- self/world attribution;
- temporal continuity;
- report grounded in actual internal state;
- lesion/perturbation experiments;
- negative controls.

## F. Homeostatic brain

- internal latent body model;
- predictive allostasis;
- resource dynamics;
- sleep/rest/offline processing;
- arousal;
- neuromodulation;
- adaptive regulation.

## G. Agency

- intention;
- inverse model;
- forward model;
- corollary copy;
- consequence prediction;
- causal attribution;
- action confidence;
- outcome learning.

## H. Development

- curriculum;
- self-directed experiments;
- skill acquisition;
- structural learning;
- model revision;
- safe self-modification;
- rollback;
- developmental trajectory.

## I. Long-horizon life

- 7 days;
- 30 days;
- 90 days;
- continuous restart;
- changing environment;
- hardware stress;
- memory stability;
- no hidden resets.

---

# 15. НОВЫЙ БОЛЬШОЙ ПЛАН: BRAIN DEVELOPMENT BRANCH

Правило ветви:

**каждый пункт ниже — один Giant Step. Внутри Giant Step может быть 10–50 конкретных изменений.**

Мелкие patches запрещены, если задача относится к одному и тому же causal subsystem.

---

## GIANT STEP B1 — Canonical Brain Substrate

### Цель

Сделать один канонический brain state, через который проходят:

perception → latent → prediction → memory → workspace → self → action → outcome → learning.

### Внутри

- вынести brain-state schema;
- убрать параллельные источники истины;
- определить canonical latent state;
- связать subsystem IDs;
- persistent causal lineage;
- deterministic snapshot;
- deterministic replay;
- убрать timestamp nondeterminism;
- убрать duplicate projections;
- сделать state provenance;
- добавить versioned migrations.

### Gate

100%:
- deterministic restore;
- replay equivalence;
- no state fork;
- no duplicate authority;
- restart equivalence.

---

## GIANT STEP B2 — Real Learned Neural Representation Core

### Цель

Перевести проект от scalar heuristics к настоящему learned latent substrate.

### Архитектура

`multimodal encoder → recurrent core → latent state → specialist heads`

### Внутри

- learned text embedding;
- learned audio embedding;
- learned vision embedding;
- sensor/body embedding;
- world-context embedding;
- modality fusion;
- recurrent state;
- temporal prediction;
- uncertainty head;
- value/utility head;
- action head;
- self-prediction head.

### Ограничение

Не огромная LLM.

Для телефона:

- small models;
- quantization;
- sparse execution;
- event-driven inference;
- cached state;
- adaptive cadence.

### Gate

Модель должна учиться на data generated by organism, показывать improvement on held-out trajectories и сохранять knowledge after restart.

---

## GIANT STEP B3 — Hippocampal–Neocortical Memory Architecture

### Цель

Превратить текущую memory ecosystem в реальную two-timescale learning system.

### Внутри

- rapid episodic encoder;
- sparse episode representation;
- replay queue;
- prioritized replay;
- cortical slow learner;
- semantic extraction;
- consolidation;
- reconsolidation;
- memory interference detection;
- protected memories;
- forgetting dynamics;
- schema formation.

### Gate

На новых задачах:

- fast acquisition;
- slow integration;
- old-task retention;
- transfer to new task;
- no catastrophic degradation.

---

## GIANT STEP B4 — Predictive Self + Agency Brain

### Цель

Сделать self и agency частью learned dynamics.

### Внутри

- intention latent;
- inverse action model;
- forward consequence model;
- corollary signal;
- internal predicted sensation;
- actual sensation;
- causal mismatch;
- self/other posterior;
- ownership;
- authorship;
- action agency.

### Ключевой критерий

Если action matches prediction случайно или из-за external control, system должна отличать:

- self-caused;
- externally-caused;
- ambiguous.

---

## GIANT STEP B5 — Recurrent Global Workspace 2.0

### Цель

Превратить workspace в реальный recurrent integration substrate.

### Внутри

- learned coalition formation;
- recurrent persistence;
- capacity bottleneck;
- competitive selection;
- broadcast;
- specialist read/write;
- ignition;
- global content identity;
- perturbation testing;
- recurrence decay.

### Негативные контроли

Проверять, что:

- broadcast без recurrence не даёт тот же результат;
- recurrence без meaningful content не создаёт false-positive;
- self-report без workspace не считается conscious evidence.

---

## GIANT STEP B6 — Metacognitive / Higher-Order Brain

### Цель

Сделать system capable of representing uncertainty about its own internal processing.

### Внутри

- confidence;
- uncertainty;
- source uncertainty;
- model uncertainty;
- self-prediction uncertainty;
- introspective prediction;
- metacognitive error;
- revision policy.

Главное:

self-report должен быть generated from internal latent state, а не из шаблонной строки.

---

## GIANT STEP B7 — Predictive Interoception / Allostatic Brain

### Цель

Преобразовать P66 из threshold controller в predictive body regulation.

### Внутри

- learned body latent;
- predicted energy;
- predicted thermal state;
- cognitive-resource prediction;
- arousal;
- sleep pressure;
- recovery;
- internal prediction errors;
- allostatic target adaptation.

### Gate

Изменение body state должно причинно изменять:

- attention;
- workspace;
- memory consolidation;
- action preferences;
- learning rate;
- exploration;
- rest;
- social behavior.

---

## GIANT STEP B8 — Neuromodulatory Learning System

### Цель

Создать реальные global modulatory signals.

### Кандидаты computationally:

- dopamine-like reward prediction error;
- norepinephrine-like unexpected uncertainty;
- acetylcholine-like precision/attention;
- serotonin-like long-timescale regulation;
- arousal/wakefulness channel.

Не называть это biological equivalence.

### Gate

Изменение modulatory state должно менять plasticity/attention/decision dynamics, а не только score.

---

## GIANT STEP B9 — Active Perception

### Цель

Организм должен сам решать, что ему воспринимать.

### Внутри

- information gain;
- sensor selection;
- curiosity;
- verification;
- camera/audio activation;
- sampling cadence;
- uncertainty-driven sensing;
- active exploration.

Источник: active perception literature.

---

## GIANT STEP B10 — Autonomous Scientific Brain

### Цель

Научный цикл должен стать внутренней функцией organism.

`question → hypothesis → prediction → experiment → observation → update → replication → revision`

### Gate

Новая гипотеза должна реально менять future policy/world model only after evidence.

---

## GIANT STEP B11 — Social Brain

### Цель

Связать theory-of-mind, social prediction, relationship memory и self-model.

### Внутри

- person-specific latent models;
- beliefs about other agents;
- uncertainty;
- prediction;
- social counterfactuals;
- trust updates;
- social memory;
- self-other boundary.

---

## GIANT STEP B12 — Developmental Brain

### Цель

Организм должен не просто learning, а **развиваться**.

### Внутри

- learning priorities;
- curriculum;
- skill hierarchy;
- internal specialization;
- model replacement;
- architecture changes;
- protected identity constraints;
- safe self-modification;
- rollback;
- developmental branching.

---

## GIANT STEP B13 — Continuous Life

### Gate sequence

500 cycles
→ 1,000
→ 10,000
→ 50,000
→ 7 days
→ 30 days
→ 90 days

На каждом уровне:

- memory growth;
- heap;
- latency;
- GC;
- state size;
- replay integrity;
- identity continuity;
- learning stability;
- action degradation;
- thermal/battery behavior.

---

## GIANT STEP B14 — Physical Brain Certification

На target Android:

- real camera;
- real audio;
- real sensors;
- real battery;
- real thermal;
- offline mode;
- degraded mode;
- process restart;
- screen lock/unlock;
- device sleep/wake;
- permissions;
- sensor failure.

No fake device evidence.

---

## GIANT STEP B15 — Brain-wide Causal Science Battery

Финальный research gate.

Не один consciousness score.

Использовать battery:

- workspace lesion;
- self-model lesion;
- memory lesion;
- recurrence lesion;
- interoception lesion;
- agency lesion;
- world model lesion;
- neuromodulation lesion;
- replay lesion;
- cross-domain interaction.

Нужны:

- positive controls;
- negative controls;
- independent repetitions;
- transfer tasks;
- cross-domain ablations.

---

# 16. Как будет измеряться прогресс

Главное правило:

**Feature status != code exists.**

Feature становится DONE только при:

1. direct behavior;
2. integration;
3. persistence;
4. replay;
5. regression;
6. negative control, где существует plausible false positive;
7. long-horizon test, когда функция temporal;
8. device evidence, если physical;
9. learning evidence, если claimed learned.

---

# 17. Новый набор уровней статуса

### SPECULATIVE
только гипотеза.

### DESIGNED
архитектура спроектирована.

### IMPLEMENTED
код существует.

### INTEGRATED
код реально участвует в core path.

### OBSERVED
работа наблюдается.

### VERIFIED
прошла строгую поведенческую батарею.

### LONG_HORIZON_VERIFIED
сохраняется в длинной жизни.

### REAL_DEVICE_VERIFIED
проверена физически.

### RESEARCH_GRADE
есть causal ablation, controls и independent evidence.

---

# 18. Что нельзя делать

Запрещается:

- score inflation;
- synthetic consciousness claims;
- fake neural networks;
- giant wrapper around deterministic formulas с названием AI;
- дублировать существующие memory stores;
- добавлять ещё один planner без удаления старой authority;
- считать generated text evidence of consciousness;
- считать scalar `consciousness01` доказательством субъективности;
- выдавать host/device mocks за physical proof;
- увеличивать архитектуру только ради количества файлов;
- принимать feature в DONE без evidence.

---

# 19. Что делать сначала

Приоритет:

### 1
Исправить deterministic snapshot defect.

### 2
Зафиксировать canonical brain state и authority graph.

### 3
Определить minimal real neural substrate.

### 4
Ввести recurrent latent state.

### 5
Связать latent state с памятью.

### 6
Связать latent state с world model.

### 7
Связать latent state с self model.

### 8
Подключить workspace как recurrent global controller.

### 9
Подключить agency/forward model.

### 10
Подключить interoception/allostasis.

### 11
Только после этого углублять higher-order / consciousness battery.

---

# 20. Что я считаю самым важным стратегическим изменением

Сейчас Neuro-Kurisu местами выглядит так:

**много умных органов + единый coordinator.**

Нужная форма:

**единый живой predictive recurrent substrate + специализированные органы, которые обучаются через общий substrate.**

То есть переход:

`ORGANS → COORDINATOR`

к:

`SUBSTRATE ↔ ORGANS ↔ SUBSTRATE`

Это самый большой архитектурный шаг всей brain branch.

---

# 21. Условия 100% готовности brain branch

Ветка считается 100% готовой только когда одновременно выполнены:

### Neural
- learned multimodal representations;
- recurrent dynamics;
- temporal memory;
- long-horizon prediction;
- learned attention/gating;
- measurable generalization.

### Memory
- episodic;
- semantic;
- procedural;
- autobiographical;
- replay;
- consolidation;
- reconsolidation;
- forgetting;
- retention.

### Self
- self latent;
- body self;
- autobiographical self;
- self prediction;
- identity trajectory;
- agency.

### World
- multimodal world model;
- causal model;
- counterfactuals;
- uncertainty;
- social world.

### Conscious-access research
- recurrent workspace;
- broadcast;
- higher-order representation;
- temporal continuity;
- grounded introspection;
- causal lesion;
- negative controls.

### Autonomy
- self-originating goal formation;
- exploration;
- research;
- sustained projects;
- long life.

### Body
- interoception;
- allostasis;
- real sensors;
- real actuators;
- real device.

### Life
- 90-day continuous run.

### Evidence
- critical functions verified;
- no critical unexplained unverified surface;
- full replay equivalence;
- reproducible release;
- no known nondeterminism;
- no false-positive consciousness claim.

Only then:

**BRAIN BRANCH = 100% ENGINEERING READY**

Phenomenal consciousness remains:

**UNKNOWN.**

---

# 22. Научная позиция

Нельзя честно сказать:

> «после B15 Neuro-Kurisu станет сознательной».

Можно честно сказать:

> «после B15 Neuro-Kurisu будет иметь существенно более сильную, целостную, recurrent, predictive, embodied, continuously learning cognitive architecture и намного более серьёзную experimental basis для исследования artificial consciousness».

Это именно тот уровень утверждения, который выдерживает проверку.

---

# Sources

1. Stanislas Dehaene et al. “Conscious Processing and the Global Neuronal Workspace Hypothesis.” Trends in Cognitive Sciences, 2020.
   https://pubmed.ncbi.nlm.nih.gov/32135090/

2. V. A. Lamme & P. R. Roelfsema. “The distinct modes of vision offered by feedforward and recurrent processing.” Trends in Neurosciences, 2000.
   https://pubmed.ncbi.nlm.nih.gov/11074267/

3. Hakwan Lau & David Rosenthal. “Empirical support for higher-order theories of conscious awareness.” Trends in Cognitive Sciences, 2011.
   https://pubmed.ncbi.nlm.nih.gov/21737339/

4. “Theories of consciousness.” Nature Reviews Neuroscience, 2022.
   https://pubmed.ncbi.nlm.nih.gov/35505255/

5. “Unpacking the complexities of consciousness: Theories and reflections.” 2025.
   https://pubmed.ncbi.nlm.nih.gov/39929381/

6. James L. McClelland, Bruce L. McNaughton, Randall C. O’Reilly. “Why there are complementary learning systems in the hippocampus and neocortex.” Psychological Review, 1995.
   https://pubmed.ncbi.nlm.nih.gov/7624455/

7. Dharshan Kumaran, Demis Hassabis, James L. McClelland. “What Learning Systems Do Intelligent Agents Need?” Trends in Cognitive Sciences, 2016.
   https://pubmed.ncbi.nlm.nih.gov/26935821/

8. David J. Foster. “Replay Comes of Age.” Annual Review of Neuroscience, 2017.
   https://pubmed.ncbi.nlm.nih.gov/28772098/

9. Kaori Takehara-Nishiuchi. “Neurobiology of systems memory consolidation.” European Journal of Neuroscience, 2021.
   https://pubmed.ncbi.nlm.nih.gov/32027423/

10. Dhairyya Singh & Anna C. Schapiro. “Evidence for complementary learning systems within the hippocampus.” 2026.
    https://pubmed.ncbi.nlm.nih.gov/42421581/

11. Donna Rose Addis & Daniel L. Schacter. “The hippocampus and imagining the future.”
    https://pubmed.ncbi.nlm.nih.gov/22291625/

12. David Ha & Jürgen Schmidhuber. “World Models.”
    https://arxiv.org/abs/1803.10122

13. Danijar Hafner et al. “Mastering Diverse Domains through World Models” (DreamerV3).
    https://arxiv.org/abs/2301.04104

14. David Rolnick et al. “Experience Replay for Continual Learning.”
    https://arxiv.org/abs/1811.11682

15. Friedemann Zenke, Ben Poole, Surya Ganguli. “Continual Learning Through Synaptic Intelligence.”
    https://proceedings.mlr.press/v70/zenke17a.html

16. Peter Sterling. “Allostasis: a model of predictive regulation.”
    https://pubmed.ncbi.nlm.nih.gov/21684297/

17. Anil K. Seth & Karl J. Friston. “Active interoceptive inference and the emotional brain.”
    https://pubmed.ncbi.nlm.nih.gov/28080966/

18. Matthis Synofzik, Gottfried Vosgerau, Albert Newen. “Beyond the comparator model: a multifactorial two-step account of agency.”
    https://pubmed.ncbi.nlm.nih.gov/17482480/

19. Lorijn Zaadnoordijk et al. “A match does not make a sense: on the sufficiency of the comparator model for explaining the sense of agency.”
    https://pubmed.ncbi.nlm.nih.gov/31110817/

20. Yann LeCun. “A Path Towards Autonomous Machine Intelligence.” 2022.
    https://openreview.net/pdf?id=BZ5a1r-kVsf

21. Ashish Vaswani et al. “Attention Is All You Need.” 2017.
    https://arxiv.org/abs/1706.03762

22. Vinod Menon. “20 years of the default mode network: A review and synthesis.” 2023.
    https://pubmed.ncbi.nlm.nih.gov/37167968/

23. Yaara Yeshurun et al. “The default mode network: where the idiosyncratic self meets the shared social world.” 2021.
    https://pubmed.ncbi.nlm.nih.gov/33483717/
