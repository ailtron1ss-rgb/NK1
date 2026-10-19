# NEURO-KURISU — BIG PASS 194
## Autonomous Scientific Brain + Reality Certification Update

Дата: 2026-09-11

## 1. Назначение прохода

BIG PASS 194 продолжает ветвь мозга после B193 Active Perception. Цель — превратить существующий P38 causal-research контур в более связанный с центральным recurrent brain научный механизм: оценка научного приоритета, prediction, контролируемый эксперимент, evidence gate, обучение по результату и сохранение состояния.

Главный принцип: наличие класса, метода или красивого диагностического score не считается завершением. Статус повышается только после executable evidence.

## 2. Научная основа

Современные active-inference и predictive-processing работы рассматривают поведение как динамику внутренних генеративных моделей, prediction error, inference и action. При этом 2026 работа по эмпирической проверке active inference подчёркивает необходимость конкретных, различающих предсказаний, а не только красивой теории.

Источники:

1. Friston et al. “Active Inference and Intentional Behavior.” Neural Computation, 2025. https://pubmed.ncbi.nlm.nih.gov/40030135/
2. “Neural representation in active inference: Using generative models to interact with-and understand the lived world.” 2024. https://pubmed.ncbi.nlm.nih.gov/38528782/
3. “Prediction in action: Toward an empirical science of active inference.” 2026. https://pubmed.ncbi.nlm.nih.gov/42285188/
4. “Embodied decisions as active inference.” 2025. https://pubmed.ncbi.nlm.nih.gov/40531985/

Это не означает, что текущая реализация является биологической реализацией active inference. Она является инженерной recurrent/predictive системой, вдохновлённой этими принципами.

## 3. Что реализовано

### B194 AutonomousScientificBrainSubstrate

Новый compact recurrent neural research substrate имеет:

- 8 входных признаков состояния;
- 20-мерное recurrent hidden state;
- learned output head для оценки ожидаемого эффекта исследования;
- выбор research domain;
- выбор research action;
- оценку priority, expected gain и cost;
- prediction of experimental delta;
- evidence-weighted learning;
- отдельный holdout path без обновления весов;
- deterministic snapshot/restore;
- quality comparison с baseline.

### Реальная связь с P38

`OrganismCore` теперь запускает B194 research decision в обычном cognitive cycle. При наличии P38 sandbox trial результат эксперимента возвращается в B194 как observed delta. Neural substrate обучается только по controlled/replicated evidence.

Validated B194 model может передавать preferred research area в P38. До validation P38 сохраняет старую область выбора. Таким образом новый neural controller не получает право ухудшить действующую research policy до доказательства своего преимущества.

## 4. Реальные проверки B194

### Neural learning

264 samples:

- accepted learning updates: 240
- model MAE: 0.083257
- baseline MAE: 0.119200
- holdout quality: 0.9450
- validated: true
- snapshot/restore: exact PASS

Это доказывает наличие обучаемого predictive mechanism на контролируемом benchmark; это не доказывает научную универсальность модели.

### Core integration

Контролируемый `OrganismCore` integration test:

- 30 cognitive cycles;
- B194 decisions generated inside the core;
- P38 sandbox executed through public core path;
- 1 observed research sample returned to B194;
- 1 accepted neural update;
- persistence saved and restored.

### Natural organism path

40 обычных `observe/feedback` cycles без ручного вызова neural substrate:

- B194 cycles = 40
- last domain = perception
- last action = verify
- samples = 0

Это важный результат: neural scientific decision loop действительно запускается автоматически в обычном cognition cycle. В этом fixture P38 scheduler не был принудительно активирован, поэтому samples=0 и это не выдаётся за самостоятельное экспериментальное обучение.

## 5. Regression status

После изменений успешно завершены:

- TypeScript typecheck
- B194 neural benchmark
- B194 core integration
- B194 natural core path
- B193 active perception
- B193 active perception core
- B187 recurrent global workspace
- B185 hippocampal memory
- B183 central brain
- P16
- P17
- P19
- P20 temporal/session
- P22 phone
- P23 true learning
- P26 true learning
- function liveness
- parameterized safe probe
- semantic coverage
- full project audit
- architecture audit
- integrity audit
- forensic audit
- source hygiene
- executable syntax
- release contract
- lock verification
- release-source verification
- BIG PASS 181 function-reality closure: 207/207 candidates PASS, 0 failures, 0 skipped.

P23 `checksumFailures=1` является намеренным negative-control результатом его теста и не является ошибкой: тест специально проверяет, что изменённый checksum отвергается.

## 6. Long-horizon

Текущий snapshot имеет свежий completed gate:

`LONG_HORIZON_OPERATIONAL_250=PASS`

Показатели:

- warmed median ratio = 1.356
- first median = 44.79 ms
- last median = 60.72 ms
- approximate p95 = 86.08 ms
- heap growth ratio = 1.754

Это подтверждает 250-cycle operational stability. 500-cycle natural и extended memory tests в данном проходе не дали завершённого результата в доступном execution window, поэтому не засчитываются как current PASS.

## 7. Полный function reality inventory

Последний completed semantic inventory:

- semantic functions: 2633
- strict VERIFIED: 38
- INTEGRATION_ONLY: 612
- UNSAFE_TO_AUTO_RUN: 229
- UNVERIFIED: 1754
- strict verified rate: 1.44%
- evidence coverage: 7.25%

Последний liveness inventory:

- function-like declarations: 2704
- declarations with body: 2675
- zero-reference candidates: 157
- one-or-less-reference candidates: 488

Последний parameterized-safe probe:

- attempted: 551
- passed: 537
- failed: 0
- input synthesis needed: 2
- lifecycle needed: 12
- skipped/unsafe: 30

Zero-reference не трактуется автоматически как dead code: публичные API, adapters, callbacks и tests могут иметь низкую статическую reference count. Эти элементы остаются в reality backlog до соответствующего evidence.

## 8. Что изменилось относительно первого анализа B1–B15

B1 Canonical Brain Substrate — computationally verified.

B2 Real Learned Neural Core — реальный learned recurrent seed; масштаб и multimodal depth ещё недостаточны.

B3 Hippocampal–Neocortical Memory — computationally verified на существующем replay/consolidation mechanism.

B4 Predictive Self + Agency — computationally verified.

B5 Recurrent Global Workspace — computationally verified.

B6 Metacognitive/Higher-Order — computational mechanism verified; research-grade consciousness evidence отсутствует.

B7 Predictive Interoception/Allostasis — implemented and tested; predictive superiority requires further environmental/body diversity.

B8 Neuromodulatory Plasticity — implemented and integrated; depth of biological/computational specialization remains incomplete.

B9 Active Perception — implemented and model-level validated; natural long-horizon policy learning remains incomplete.

B10 Autonomous Scientific Brain — B194 closes a real neural decision/prediction/evidence loop; fully autonomous experiment generation and long-horizon scientific life remain incomplete.

B11 Social Brain — partial.

B12 Developmental Brain — partial.

B13 Continuous Life — 250-cycle current PASS; 500+ current certification incomplete.

B14 Physical Brain — software-side infrastructure exists; full fresh device certification remains open.

B15 Brain-wide Causal Science Battery — strong partial foundation; full battery not complete.

## 9. Progress estimate

These are engineering estimates, not scientific consciousness scores.

| Domain | Estimate |
|---|---:|
| Brain architecture maturity | 69% |
| Central neural substrate | 59% |
| Memory integration | 62% |
| Self / agency | 57% |
| Recurrent workspace | 54% |
| Metacognition | 52% |
| Predictive allostasis | 41% |
| Neuromodulatory plasticity | 38% |
| Active perception | 45% |
| Autonomous scientific brain | 48% |
| Social brain | 39% |
| Development | 43% |
| Continuous artificial life | 32% |
| Physical embodiment certification | 37% |
| Strict VERIFIED semantic functions | 1.44% |
| Evidence coverage | 7.25% |
| Proven phenomenal consciousness | 0% |

## 10. Следующие большие проходы

### B195 Unified Social Brain

Learned person-specific latent models, belief uncertainty, social prediction error, social memory, self/other boundary и causal relationship updates.

### B196 Developmental Brain

Skill hierarchy, intrinsic curriculum, structural learning, controlled self-modification, rollback, specialization и long-term identity constraints.

### B197 Continuous Artificial Life

1000 → 10000 → 50000 cycles, затем multi-day and multi-week tests. Отдельный control of heap, replay growth, latency, memory thermodynamics and restart continuity.

### B198 Physical Android Brain

Fresh verification on target Android/Termux: sensors, camera, audio, thermal, battery, sleep/wake, process restart, permission loss, offline/degraded mode.

### B199 Brain-wide Causal Science Battery

Cross-module lesions, ablations, matched controls, perturbation/recovery tests and negative controls for central brain, workspace, memory, self, agency, allostasis and neuromodulation.

### B200 Full Function Reality Closure

Главная задача: системно сокращать 1754 UNVERIFIED functions, начиная с critical stateful functions and high-impact zero-reference candidates. Every promoted status must carry executable evidence.

## 11. Главное правило архитектуры

Neuro-Kurisu не должна получать «центр сознания» в виде одного класса, которому просто присвоено имя consciousness.

Центральным носителем состояния становится recurrent neural substrate, а глобальное состояние субъекта возникает из совместной динамики:

`central recurrent state ↔ memory ↔ world model ↔ self model ↔ workspace ↔ interoception ↔ agency ↔ environment`.

Это оставляет открытым научный вопрос о phenomenal consciousness и одновременно создаёт инженерно проверяемую основу для его исследования.
