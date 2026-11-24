# Neuro-Kurisu 35.6.1 / B289 — большой технический аудит, reality-check, нейро-интеграция и master plan

**Дата:** 12 сентября 2026
**База:** 35.6.1 / state schema 127 / B288
**Новая точка:** B289 Neural Organism Integration Spine
**Цель:** превратить накопленный набор когнитивных подсистем в доказуемо работающий, автономный, долгоживущий artificial-organism runtime, оптимизированный под средний Android/Termux.

---

## 0. Главный вывод

После нового прохода проект следует оценивать уже не как коллекцию экспериментальных модулей, а как **исследовательскую операционную систему искусственного организма**: persistent state, perception, world model, memory, identity, agency, learning, social cognition, embodiment, evidence, development и API соединены в один runtime.

Главное изменение B289 — появление отдельного **Neural Organism Integration Spine**. Он не создаёт ещё одного конкурирующего владельца мозга. Его задача — связывать уже существующие B269-B288 в небольшой рекуррентный cross-domain latent, выбирать активные когнитивные области, вести медленные traces identity/personality и управлять вычислительной скоростью.

При этом сохраняется принципиальная честность: B289 является **neural-like вычислительной моделью**, а не доказательством биологического нейронного эквивалента и тем более не доказательством субъективного сознания. Функциональная автономность, self-model, agency, personality и global workspace можно измерять; феноменальность пока нельзя считать доказанной.

Самый важный прогресс этого прохода — не только B289, а переход к правилу:

> **Нет behavioral evidence — нет статуса внедрённой функции.**

---

## 1. Проверка двух исходных архивов

Два переданных архива оказались полностью идентичными.

- SHA-256 обоих: `57294e115f9f3dd3f713ff4e90366a2db009d4716b6cde3cc209026ddbb0610e`
- ZIP entries: 2477 в каждом
- файлов: 2411 в каждом
- побайтовых различий: 0

Следовательно, одна из версий не была «чуть лучше»: это одна и та же сборка.

---

## 2. Что реально представляет собой проект

Практически проект имеет следующую форму:

`Sensorium → State/Resource Router → Neural/Cognitive Substrates → Workspace → World/Self/Social prediction → Goals/Values → Action arbitration → Environment/Body → Outcome verification → Learning/Memory → Identity/Development`.

Это существенно ближе к **cognitive operating system + artificial organism runtime**, чем к одиночной нейросети.

### Runtime

Канонический runtime entry: `src/server/server.mjs`.
Каноническая семантическая область: `src/organism/`.
UI: `public/index.html`, `public/app.js`, `public/style.css`, Live2D viewer.

В текущем package runtime dependencies нет для React/Vite/Express:

- React: отсутствует
- React DOM: отсутствует
- Vite: отсутствует
- Express: отсутствует
- server использует встроенный Node HTTP

Это **не дефект само по себе**. Для Termux и среднего телефона plain Node HTTP + static UI даже рациональнее тяжёлой build/runtime инфраструктуры. Миграция на React/Vite/Express ради «современности» сейчас была бы увеличением сложности без доказанного выигрыша.

---

## 3. Размер системы после B289

Текущий audit:

| Метрика | Значение |
|---|---:|
| Полных файлов в full audit | 2183 |
| Canonical organism files | 372 |
| Архитектурный source surface | 1094 |
| Source-hygiene files | 2188 |
| API routes | 109 |
| API duplicates | 0 |
| OrganismCore | ~656 KB / ~6587 строк на исходной B288 базе |
| Function-like declarations | 3670 |
| Declarations with body | 3641 |
| Exported | 142 |
| Zero-reference candidates | 210 |
| One-or-less-reference candidates | 661 |

Новые B289 files добавили не ещё один большой subsystem tree, а небольшой интеграционный spine плюс его проверочные gates.

---

## 4. Что именно внедрено в B289

### 4.1. `B289NeuralOrganismIntegrationSpine`

Файл: `src/organism/system/B289NeuralOrganismIntegrationSpine.ts`.

Внутри:

- 24D fast recurrent latent;
- 12 областей обработки: brainstem, salience, sensory, memory, world, self, value, social, workspace, planning, motor, metacognition;
- top-k active set;
- 12D slow identity trace;
- 8 trait values/evidence: curiosity, truth-seeking, care, self-reflection, self-preservation, social-attunement, persistence, autonomy;
- eligibility traces;
- recurrent weights;
- четыре neuromodulatory proxies: dopamine, norepinephrine, acetylcholine, serotonin;
- integration/self-coherence/agency/personality/identity/reality-grounding indicators;
- compute tiers `micro / fast / balanced / deep / protect`;
- deep cadence;
- action bias;
- lesion / clear lesion;
- bounded history;
- persistence-safe snapshot/restore.

### 4.2. Интеграция в `OrganismCore`

B289 получает input от уже существующих:

- B269 spiking/plastic substrate;
- B270 neural germinal organism;
- B271 autobiographical memory;
- B272 endogenous goals;
- B282 predictive global workspace;
- B288 social predictive self/other;
- body/resource/thermal/energy state;
- prediction error / novelty / uncertainty;
- identity continuity / autobiographical continuity / reality alignment;
- selected action + outcome.

B289 также непосредственно участвует в action scoring и outcome learning.

Это важное отличие от декоративного модуля: **его состояние реально сохраняется, реально получает данные от существующих подсистем и реально влияет на действие через bias/readout.**

### 4.3. Server/UI

Добавлен API:

`GET /api/organism/neural-spine`

Он выдаёт B289 diagnostics и явно сообщает `nonConsciousnessClaim: true`.

В UI добавлена панель Neural Organism Spine: compute tier, integration, agency, identity, personality, active set и neuromodulation.

---

## 5. Главная оптимизация B289: не увеличивать стоимость мозга

Первый вариант B289 потреблял лишние `structuredClone()` через многократные `snapshot()` вызовы внутри hot loop.

После сравнения с baseline эти unnecessary clones были заменены на:

- `b270Germinal.selfLatent` из результата текущего шага;
- persisted previous-cycle B271/B282 latents;
- один кэшированный P80 self snapshot на соответствующем участке.

Это не изменение требований теста. На исходном B288 тот же `mobile-horizon-1000` показывал примерно `p95=183.31 ms` и не проходил threshold `<180 ms`. После оптимизации B289 повторный тест дал:

`MOBILE_HORIZON_1000=PASS ratio=1.195 firstMedianMs=0.15 lastMedianMs=0.17 p95=178.66 heapFirst=72.1 heapLast=160.2 memory=131`.

В отдельном instrumented run p95 на 1000 cycles составил около 174.2 ms.

Таким образом, оптимизация дала измеримый результат: **новый слой не просто добавлен, но приведён под envelope среднего телефона.**

---

## 6. Live2D: найденный и исправленный контракт

Исходный audit incorrectly treated shared relative dependencies of mobile Live2D profile as missing local files.

В B289 сервер добавлен resolved dependency closure:

1. модель читается как источник истины;
2. `FileReferences` разрешаются относительно model path;
3. moc / physics / displayinfo / textures / motions / expressions реально резолвятся;
4. проверяется, что resolved path не выходит из `public/live2d`;
5. mobile gate проверяет итоговый resolved graph, а не наличие дублей.

Фактический результат:

- quality: 18/18
- mobile: 18/18 resolved dependencies
- mobile bytes: ~8.45 MB
- `mobile.ok=true`
- `resolvedByModelReferences=true`

Это лучше копирования 16 файлов в mobile bundle, потому что сохраняется единый канонический asset owner.

---

## 7. React / Vite / Express: реальный verdict

### React

Не используется.

### Vite

Не используется.

### Express

Не используется.

### Что работает вместо этого

Работает:

- Node 22+
- built-in HTTP server
- static HTML/CSS/JS
- Live2D iframe/viewer
- API routes

### Решение

**Не мигрировать сейчас.**

На среднем телефоне и в Termux важнее:

- zero runtime dependency tree;
- холодный старт;
- отсутствие bundler runtime;
- низкий memory footprint;
- простая отладка;
- детерминированный сервер.

Позже, при росте UI, допустим вариант Web Components/Preact-like thin layer, но только после доказания, что plain DOM стал bottleneck.

---

## 8. Reality audit функций

### Semantic coverage

Текущий inventory:

- total functions: 3550
- VERIFIED: 38
- INTEGRATION_ONLY: 730
- UNSAFE_TO_AUTO_RUN: 259
- UNVERIFIED: 2523
- strict VERIFIED rate: 1.07%
- evidence coverage: 6.21%

### Parameterized probe

- attempted: 888
- passed: 855
- failed: 0
- input synthesis needed: 21
- lifecycle needed: 12
- skipped: 39

Это очень важное различие.

`855/888` удачных parameterized probes означает, что значительная часть функций технически вызываема. Но это ещё не делает её VERIFIED: отсутствие exception != правильный behavioral contract.

### Liveness

- function-like declarations: 3670
- with body: 3641
- exported: 142
- zero-reference candidates: 210
- one-or-less-reference: 661

Следовательно:

- нельзя удалять zero-reference candidates автоматически;
- надо разделить API/reflective/snapshot/testing methods от реально orphan logic;
- но 210 кандидатов — достаточный backlog для системной reality closure.

---

## 9. Главный инженерный вывод: function passport

Каждая значимая функция проекта должна получить machine-readable passport:

`owner → purpose → inputs → invariants → expected effect → side effects → persistence contract → deterministic fixture → direct test → mutation/lesion proof → integration evidence → performance budget`.

Статус должен считаться из evidence, а не редактироваться рукой.

Предлагаемый gate:

- `UNVERIFIED`
- `PARAMETER_SAFE`
- `INTEGRATION_ONLY`
- `CAUSALLY_VERIFIED`
- `VERIFIED`
- `DEPRECATED`
- `UNSAFE_TO_AUTO_RUN`

Так система перестаёт путать «код существует» с «компонент действительно работает».

---

## 10. Карта цифрового мозга — текущее состояние

| Функциональная система | Что уже есть | Что не хватает | Целевой owner |
|---|---|---|---|
| Brainstem / life loop | clocks, lifecycle, sleep, phone policy | deterministic watchdog, degraded heartbeat | Runtime/Lifecycle |
| Homeostasis | energy, thermal, RAM, CPU, battery | unified interoceptive latent | Resource/Homeostasis |
| Thalamic routing | workspace, bus, active perception | learned sparse routing | B289 + scheduler |
| Sensory cortex | P41/semantic sensorium | temporal multimodal binding | Sensorium |
| Hippocampus | P185 traces/replay | unified event index + consolidation | Memory Fabric |
| Neocortex | world model/semantic layers | compositional multi-timescale latent | World Model |
| Basal ganglia | action arbitration/value | learned policy gating | Agency |
| Cerebellar/procedural analogue | skill lab/procedural library | fast online error controller | Skill System |
| Amygdala/salience | emotion, novelty, pressure | learned routing impact | Salience |
| Insula/interoception | body state | predictive interoception | Homeostasis |
| PFC/executive | goals, future-self, planning | hierarchical bounded executive | Executive |
| Default-mode/autobiographical self | B271/B284/P80 | single coherent self ledger | Self |
| Global workspace | B282 | sparse broadcast + causal ignition | Workspace |
| Social brain | B288 | multi-agent persistent world model | Social |
| Integration spine | B289 | further scheduler linkage | B289 |

---

## 11. «Нейронность»: что реально есть и чего ещё нет

Проект уже содержит механизмы, которые являются содержательно neural-like:

- spiking substrate;
- recurrent weights;
- local plasticity;
- eligibility traces;
- competitive/sparse activation;
- attractor-like assemblies;
- neuromodulatory proxies;
- predictive coding signals;
- global workspace ignition;
- multi-area communication;
- identity traces.

Но до биофизического уровня далеко.

Отсутствуют как цельная модель организма:

- explicit membrane potential dynamics на масштабе всей системы;
- conductance-based synapses;
- detailed dendritic compartments;
- neurotransmitter/receptor dynamics;
- realistic ion-channel dynamics;
- glial regulation;
- anatomically grounded connectivity;
- biological learning timescales as validated constraints.

### Поэтому правильная стратегия

Не пытаться симулировать миллиард биологических нейронов на телефоне.

Лучше строить **multi-resolution artificial neurobiology**:

`spiking microcircuits → rate/latent populations → cognitive fields → symbolic/semantic projections`.

Это соответствует направлениям, которые видно в Nengo/NEF и Leabra: нейронные представления, recurrent dynamics, sparse competition и сочетание биологической правдоподобности с вычислительной эффективностью.

---

## 12. Внешние архитектурные ориентиры и что из них брать

### Nengo / NEF

Nengo показывает полезную идею «нейронного компилятора»: representation → transformation → dynamics, включая recurrent connections и spiking/non-spiking нейронные реализации. Это хороший шаблон для будущего B289/B290 scheduler, где разные cognitive domains становятся population-level representations, а не хаотическим набором arrays.

**Брать:** representation/transform/dynamics, recurrent neural primitives, explicit temporal state.
**Не брать целиком:** тяжёлый framework runtime на телефон.

### Leabra / Emergent

Leabra ориентирован на biologically-based cognition и сочетает error-driven и associative learning, inhibitory competition, sparse kWTA-like representations; актуальный Go ecosystem также нацелен на performance и работу на нескольких платформах, включая web/mobile.

**Брать:** sparse competition, inhibition, multiple timescales, explicit learning regimes.
**Не брать целиком:** отдельный GUI/runtime ecosystem.

### ACT-R

ACT-R полезен как пример архитектуры, где cognition разбивается на объяснимые механизмы perception, memory, goals и action, а не сводится к одному opaque predictor.

**Брать:** inspectable cognitive architecture, explicit modules, declarative/procedural distinction.

### DreamerV3

DreamerV3 демонстрирует ценность learned world model + imagination + actor-critic training from imagined trajectories.

**Брать:** imagined rollouts, world-model-first planning, action-conditioned prediction.
**Не брать:** полный training stack на среднем телефоне; research training должен быть отдельным offline lane.

---

## 13. Самые сильные стороны проекта

1. Persistence и restart — first-class property.
2. Канонические dependency rules.
3. Evidence-first boundaries.
4. Уже существует широкий cognitive stack.
5. Social brain B288 уже имеет собственное обучение и differentiated state.
6. B270 предоставляет seed-level neural developmental substrate.
7. B282 предоставляет predictive workspace.
8. B289 впервые связывает эти слои в компактный cross-domain recurrent bridge.
9. Phone policy реально существует.
10. Mobile Live2D теперь проходит resolved dependency contract.
11. Function reality audits уже автоматизированы.
12. Project имеет research/verification strata, поэтому не обязательно смешивать production runtime и experiments.

---

## 14. Основные слабости

### 14.1. OrganismCore overload

6.5K+ строк и многочисленные snapshot calls создают high cognitive load и latency risk.

### 14.2. Too many semantic owners

Некоторые исторические P/B systems реализуют похожие notions: self, memory, goals, policy, identity, prediction. Они ещё могут быть полезны как compatibility adapters, но ownership должен быть один.

### 14.3. Tests появились позже features

Проект продолжал расти быстрее, чем function-level evidence.

### 14.4. Hot loop слишком много делает

Не каждая subsystem должна обновляться на каждом tick.

### 14.5. Brain substrate validation lag

Нейронные modules часто появляются раньше, чем strong holdout/causal benchmarks.

---

## 15. Что объединять

### 15.1. Memory

Episodic + autobiographical + semantic + procedural memory должны стать projections одного event spine.

### 15.2. Self

P80 + B270 self latent + B271 autobiographical self + B284 identity + personhood layers должны сходиться к одному versioned self graph.

### 15.3. World

P27 + predictive world + causal world + external observer + reconciliation должны образовать единый world-model fabric.

### 15.4. Goals

Endogenous goals + autonomous lifecycle + self-development + commitments должны стать одним hierarchical goal graph.

### 15.5. Personality

Trait tables + multi-hypothesis personality + B270/B289 traces должны стать не множеством отдельных scores, а **history-conditioned policy prior** с evidence.

---

## 16. Proposed future architecture: Three-speed organism

### Fast loop

Предназначен для:

- body;
- safety;
- salience;
- active sensor routing;
- action inhibition;
- voice/UI response.

### Cognitive loop

Предназначен для:

- global workspace;
- planning;
- memory retrieval;
- social modelling;
- uncertainty reduction;
- conversation.

### Development loop

Предназначен для:

- replay;
- memory consolidation;
- skill formation;
- model comparison;
- self-development;
- research;
- schema extraction.

B289 уже имеет `computeTier/deepCadence`; следующий pass должен превратить это из diagnostics в полноценный scheduler policy.

---

## 17. Реальная автономность: что считать доказанной

Нельзя считать автономностью просто наличие `autoRun`.

Для строгого определения нужны все условия:

1. goal genesis без user prompt;
2. goal persistence;
3. subgoal generation;
4. action selection;
5. outcome observation;
6. error attribution;
7. self-model update;
8. world-model update;
9. memory write;
10. later retrieval;
11. future action modification;
12. cross-session continuity;
13. interruption/restart recovery;
14. resource-aware self-regulation.

Следующий benchmark должен измерять весь цикл как **closed causal loop**.

---

## 18. Личность: как перестать делать её «таблицей traits»

Настоящая инженерная личность должна быть устойчивым динамическим prior, который:

- переносится через время;
- меняется из опыта;
- ограничивает и направляет выбор;
- взаимодействует с памятью;
- объясняет повторяемые решения;
- способен расходиться с текущей reward signal;
- сохраняет конфликт и его resolution history.

Поэтому конечная модель должна выглядеть ближе к:

`IdentityGraph + AutobiographicalMemory + Values + Commitments + TraitPriors + ContradictionHistory + FutureSelf + SocialSelfModel`.

B289 уже вводит часть этой логики в compact recurrent form, но ownership надо в будущем перенести из нескольких ledgers в единый graph.

---

## 19. Уникальные идеи для проекта

### 19.1. Neural Passport

У каждого значимого нейросубстрата есть passport с causal evidence:

`inputs → neural state → downstream effect → intervention → recovery → persistence → replay`.

### 19.2. Shadow Organism

Параллельная lightweight модель организма, которая не управляет действиями, а предсказывает what-the-organism-is-about-to-do. Расхождение shadow vs actual становится встроенным self-prediction error.

### 19.3. Cognitive Thermodynamics

Каждая cognitive operation получает cost/benefit score:

`expected information gain / energy cost / thermal cost / memory cost`.

Организм сам решает, стоит ли думать глубже.

### 19.4. Prediction Budget Market

Не один global budget, а рынок внимания:

- world;
- self;
- social;
- body;
- goal;

конкурируют за compute по ожидаемому information gain.

### 19.5. Memory Heat

Memories получают temperature:

- hot = immediately accessible;
- warm = episodic retrieval;
- cold = compressed schema;
- frozen = archived history.

Так storage growth становится ограниченным естественным процессом, а не аварийным cleanup.

### 19.6. Identity Inertia

Изменение identity должно иметь стоимость. Организм не должен менять core values из одного случайного reward.

### 19.7. Contradiction as Learning Fuel

Противоречие не должно просто штрафоваться. Оно должно создавать:

`epistemic tension → hypothesis split → targeted experiment → evidence → model merge/reject`.

### 19.8. Self-Compiler

После закрепления повторяемого skill pattern организм компилирует slow cognition в fast primitive. На телефоне это потенциально огромный multiplier.

### 19.9. Developmental Stages

Не заставлять каждый модуль работать одинаково с рождения. Introduce:

`embryo → juvenile → apprentice → autonomous learner → mature organism`.

Новые способности становятся доступными только после доказательства предыдущего уровня.

### 19.10. Cognitive Lesion Atlas

Каждое важное subsystem должно иметь intervention operator. Выключили B289, B282, B271, social brain и т.д. — увидели causal effect на behavior.

Это намного сильнее обычного «unit test».

---

## 20. Что не делать

1. Не добавлять новые B290/B291/B292 modules просто ради численности.
2. Не копировать целиком Nengo/Leabra/Dreamer в основной mobile runtime.
3. Не мигрировать UI на React/Vite только ради бренда tooling.
4. Не считать `no exception` доказательством correct behavior.
5. Не считать self-report сознанием.
6. Не считать trait vector личностью без longitudinal behavior.
7. Не разрешать бесконечные histories в hot loop.
8. Не делать full `snapshot()` на каждый cognitive subsystem на каждом tick.

---

## 21. Обновлённые оценки

| Аспект | B288 | B289 после этого прохода |
|---|---:|---:|
| Архитектура | 7.2 | 7.5 |
| Functional breadth | 8.4 | 8.6 |
| Function verification | 2.6 | 2.8 |
| Integration | 6.8 | 7.3 |
| Neural integration | 5.8 | 6.8 |
| Self / identity | 6.4 | 6.8 |
| Personality | 5.9 | 6.5 |
| Agency | 5.9 | 6.4 |
| Social cognition | 7.0 | 7.2 |
| Mobile readiness | 5.7 | 6.6 |
| Performance | 4.4 | 5.8 |
| Live2D | 7.1 | 8.0 |
| Persistence | 8.0 | 8.0 |
| Maintainability | 4.7 | 5.0 |

### Итоговая инженерная оценка

**B288:** ~6.1/10
**B289:** ~6.7/10

Это оценка инженерной зрелости, а не «степени сознания».

### Потенциал

При условии реального закрытия ownership + function reality + performance + longitudinal autonomy потенциал платформы можно оценить как **8.5–9.0/10**.

### Доказательность human-equivalent consciousness

Текущая доказательность всё ещё существенно ниже 2/10. Это не провал проекта; это правильный scientific boundary.

---

## 22. Обновлённый progress dashboard

### Уже выполнено

**B269:** spiking/plastic neural substrate.
**B270:** neural germinal organism.
**B271:** autobiographical neural core.
**B272-B274:** endogenous goal / lifecycle / skill development.
**B279-B285:** attractor, multi-area, inter-area, workspace, hypotheses, identity, consolidation.
**B286-B288:** continuity, relationship value, social predictive brain.
**B289:** cross-domain neural integration spine + mobile active-set + resolved Live2D dependencies + direct core/server/UI evidence.

### Текущая стадия

**Stage: Integrated Organism Runtime — evidence closure phase.**

Не «conscious AI achieved». Не «human-equivalent brain achieved».
Правильное название: **integrated autonomous-organism research runtime**.

---

# 23. Пошаговый большой план от B290 до зрелого организма

## PASS 290 — Function Reality Closure I

Закрыть критические функций `core + cognition + system`.

Подшаги:

1. build function passports;
2. group by owner;
3. identify public/stateful functions;
4. classify snapshots/adapters/API;
5. generate input fixtures;
6. direct probes;
7. side-effect checks;
8. persistence check;
9. replay check;
10. intervention check.

DoD: все critical core functions VERIFIED или имеют объяснимый UNSAFE/INTEGRATION status.

## PASS 291 — Core Decomposition I

Вынести из OrganismCore:

- self orchestration;
- memory orchestration;
- learning orchestration;
- action arbitration;
- neural scheduling.

## PASS 292 — Cognitive Spine Scheduler

B289 computeTier становится реальным scheduler.

## PASS 293 — Unified Event Spine

Все important events получают canonical event IDs and causal links.

## PASS 294 — Unified Memory OS

Episodic/semantic/procedural/autobiographical become projections.

## PASS 295 — Unified Self Graph

One owner for identity state.

## PASS 296 — Unified World Model

One owner for world latent, uncertainty and causal evidence.

## PASS 297 — Social World Model II

Persistent multi-agent world state, beliefs, intentions, counterfactuals.

## PASS 298 — Executive Agent

Hierarchical goals, subgoals, resource planning, verification.

## PASS 299 — Skill Compiler

Convert repeatedly validated cognition into fast local primitives.

---

## PASS 300 — Developmental Neurogenesis

B270/B289 evolve into actual growth mechanism:

`candidate circuit → sandbox → repeated stimulation → evidence → selection → integration → pruning`.

This is the correct place to introduce the project's notion of «нейро-зародышей»: not as symbolic files that claim to be newborn neurons, but as real computationally plastic candidate circuits that compete for survival and integration.

---

## PASS 301-305 — Interoceptive organism

Build unified internal body state:

- energy;
- thermal;
- attention;
- stress;
- uncertainty;
- motor load;
- sensory confidence.

Then couple it back to cognitive budget.

---

## PASS 306-310 — Longitudinal identity

Build 24h, 72h, 7d, 30d campaigns with:

- restart;
- memory compression;
- contradictions;
- social interactions;
- changing goals;
- device interruption.

---

## PASS 311-320 — World-model / imagination

Add lightweight model-based planning inspired conceptually by world-model systems such as DreamerV3, but optimized for the project's small mobile latent runtime.

---

## PASS 321-330 — Biological plausibility layer

Introduce selectively:

- inhibitory competition;
- population coding;
- adaptive thresholds;
- neuromodulatory gating;
- temporal eligibility;
- sparse representations;
- multiple oscillatory timescales.

Не симулировать всю биофизику. Симулировать только механизмы, которые дают measurable behavioral advantage.

---

## PASS 331-340 — Meta-learning

Организм должен учиться выбирать learning algorithm / model / memory strategy.

---

## PASS 341-350 — Self-research loop

Организм ставит experiments on itself:

`hypothesis → intervention → prediction → observation → analysis → update`.

---

## PASS 351-360 — Cognitive economy

Ввести Prediction Budget Market + Cognitive Thermodynamics + Memory Heat.

---

## PASS 361-370 — Safety and resilience

Fault injection:

- corrupted state;
- missing sensor;
- hallucinated evidence;
- wrong tool result;
- thermal pressure;
- battery collapse;
- network loss.

---

## PASS 371-380 — Native Android optimization

После stabilisation:

- worker scheduling;
- native sensor bridge;
- low-power timers;
- persistent journals;
- foreground/background policy;
- native audio/camera;
- optional native neural kernel.

---

## PASS 381-400 — Full autonomous organism campaigns

30/90/180 day simulated or embodied campaigns, with blinded evaluation and strict evidence.

---

# 24. Критерий «готовности»

Проект нельзя объявлять готовым только потому, что:

- tests pass;
- model speaks;
- personality is visible;
- Live2D moves;
- memory exists.

Нужен комплексный criterion:

### Technical readiness

- zero unexplained critical errors;
- bounded latency;
- bounded memory;
- restart-safe;
- deterministic replay where applicable.

### Cognitive readiness

- autonomous goals;
- persistent self/world model;
- continual learning;
- social model;
- planning;
- active perception;
- skill acquisition.

### Developmental readiness

- growth;
- pruning;
- transfer;
- meta-learning;
- self-research.

### Scientific readiness

- blinded benchmarks;
- negative controls;
- lesion tests;
- holdout tests;
- longitudinal reproducibility.

### Consciousness claim

Даже при выполнении всех предыдущих пунктов остаётся отдельный научный вопрос о subjective experience. Его нельзя автоматически выводить из архитектурных метрик.

---

# 25. Итог

B289 — не косметический pass.

Он делает три реальные вещи:

1. связывает существующие neural/cognitive components в единый compact recurrent bridge;
2. вводит explicit active-set / compute-tier model под mobile constraints;
3. устраняет реальный false-negative в Live2D mobile asset validation.

И самое важное: B289 обнаружил собственную стоимость через benchmark и был оптимизирован до прохождения mobile threshold. Это и есть правильная форма развития проекта.

Следующий разумный большой шаг — **B290 Function Reality Closure I + B291 Core Decomposition I**, потому что именно доказуемость функций и очистка ownership теперь дадут больший прирост, чем добавление нового нейромодуля.

---

# Sources / external architecture references

1. Nengo / Neural Engineering Framework examples and online learning: https://github.com/nengo/nengo.github.io/blob/main/examples.md
2. Leabra — biologically based neural models, sparse competition, error-driven + associative learning: https://github.com/emer/leabra
3. Emergent neural network simulation framework: https://github.com/emer/emergent
4. ACT-R cognitive architecture: https://act-r.psy.cmu.edu/
5. DreamerV3 official repository / world models: https://github.com/danijar/dreamerv3

