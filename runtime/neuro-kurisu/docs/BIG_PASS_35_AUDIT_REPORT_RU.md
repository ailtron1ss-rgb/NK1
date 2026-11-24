# NEURO-KURISU — BIG PASS 35
# Аудит → реализация → контроль прогресса

Дата: 2026-09-05
Базовая версия: 34.2.0
Обновление: 34.4.0
Профиль: средний Android-телефон + Termux

---

## 1. Принцип этого прохода

Главный критерий: изменение принимается только тогда, когда оно повышает эффективность, надёжность, правдивость или полезную когнитивную связь. Функции, которые лишь увеличивают количество P-номеров или метрик, не добавлялись.

Отдельное правило: simulated/internal evidence не должна называться external evidence.

---

## 2. Что найдено в исходной системе

В архиве обнаружен большой canonical runtime с `src/organism`, server, tests, research и legacy-слоем. Современное ядро уже содержит persistence, migrations, prediction ledger, cognitive budget, reality-first observatory, model ecology, perception и Android/Termux bridge.

Крупнейший архитектурный hotspot — `src/organism/core/OrganismCore.ts`: около 3074 строк и около 140 import-связей. Поэтому этот проход не расширяет monolith и не добавляет новый P-модуль вместо рефакторинга существующих связей.

---

## 3. Реализованные исправления

### 3.1 P40 Model Ecology

До прохода модельная экология умела считать quality/latency/reliability, но не имела явного circuit breaker и защищённого состояния старых профилей.

Теперь:

- `configured` отделён от runtime availability;
- профиль может войти в cooldown;
- считаются consecutive failures;
- сохраняются last success/failure timestamps;
- после повторных отказов backend временно исключается из routing;
- legacy state восстанавливается через merge с default profile.

Эффект: один мёртвый локальный/cloud backend больше не должен бесконечно тормозить мобильный cognitive path.

### 3.2 Адаптивная сенсорика

Ранее `PhoneRuntimePolicy` вычисляла adaptive `sampleDelayMs`, но embodiment clock продолжал планироваться через фиксированный `sensorIntervalMs`.

Теперь scheduler использует текущее решение policy.

Следствие: высокий battery/thermal/RAM/CPU pressure реально снижает частоту sensor sampling.

### 3.3 Runtime Evidence Bus

Добавлен bounded integration spine:

`observation → prediction → action → outcome → model/resource evidence`

Он не заменяет durable event log. Его задача — дать runtime единую короткую цепочку доказательных связей и основу для дальнейших prediction/evidence исследований без создания второго полного event-sourcing stack.

### 3.4 Truthfulness boundary

Ранее симулированный `WorldEnvironment` transition технически мог быть представлен как external evidence в новом evidence stream.

Исправлено: simulated world теперь явно `external01=false` и имеет source `simulated-world-environment`.

Это фундаментальная правка методологии: внутренний симулятор не может сам стать независимым подтверждением реальности.

### 3.5 Android/Termux

Добавлены/исправлены:

- process CPU signal через `process.cpuUsage()` совместно с system load;
- stale age для telemetry;
- безопасный environment override `NEURO_SCREEN_INTERACTIVE`;
- `termux-api` включён в install dependency.

### 3.6 P41 native perception

Выявлена конкретная техническая ошибка: audio low/mid/high вычислялись как части массива sample indices, что не является частотным разбиением.

Исправлено на coarse Goertzel frequency probes.

Также image edge density больше не использует одномерную последовательность пикселей; вычисление идёт по горизонтальным/вертикальным соседям.

Результат: дешёвая native perception остаётся мобильной, но её названия теперь лучше соответствуют физическому смыслу вычисления.

---

## 4. Изменения API

Добавлен GET:

`/api/organism/runtime-control`

Он показывает:

- adaptive phone policy;
- body state;
- runtime clocks;
- bounded evidence stream.

Это диагностический endpoint, а не новый cognitive authority.

---

## 5. Версионирование

Release обновлён с 34.2.0 → 34.4.0.

State schema не изменялся: новые P40 runtime-поля backward-compatible и корректно восстанавливаются из старого state через merge/default migration path.

---

## 6. Реальная проверка

### Статические проверки

- typecheck: PASS
- architecture: PASS
- source truth: PASS
- API routes: PASS, duplicates=0
- analysis alignment: PASS
- BIG PASS progress audit: PASS

### Регрессии

- BIG_PASS_35_HARDENING: PASS
- P40 model ecology: PASS
- P41 native perception: PASS
- P41 performance: PASS; 10000 cycles ≈ 1.77 s после оптимизации coarse spectral probes (первый вариант 2.1 s был отклонён как слишком дорогой)
- P57 reality-first: PASS
- Runtime clocks: PASS
- P30 continual learning: PASS
- P46 prediction ledger: PASS
- P56/P57 integration persistence: PASS
- restart persistence, memory dedupe, identity lock, concurrency, API security, portable subject — PASS в текущей повторной выборке.

### Важное ограничение

Полная историческая `audit:all` кампания ранее имела timeout на длинном composite/replay пути. Этот проход не маскирует это как PASS; отдельные быстрые и средние тесты снова проходят. Полный long-horizon gate остаётся отдельным следующим эксплуатационным milestone.

---

## 7. Контрольный список большой программы

### A. Phone Survival

- [x] adaptive sensor delay
- [x] process CPU signal
- [x] telemetry staleness
- [x] Termux API installation
- [x] backend circuit breaker
- [ ] native Android lifecycle host
- [ ] thermal-zone/SoC specific telemetry
- [ ] battery-aware LLM tier scheduling

Прогресс блока: **55%**

### B. Evidence / Prediction

- [x] Prediction Ledger уже присутствует
- [x] Runtime Evidence Bus
- [x] simulated vs external boundary
- [x] external evidence endpoint/observatory уже присутствует
- [ ] durable causal links across all subsystems
- [ ] calibrated evidence trust hierarchy
- [ ] prediction improvement benchmark

Прогресс блока: **57%**

### C. Cognitive Budget

- [x] CognitiveBudgetManager уже присутствует
- [x] resource-aware phone policy
- [x] proposal suppression under defer/sleep pressure
- [ ] monetary/energy/information cost model
- [ ] unified budget shared by LLM/memory/research/simulation

Прогресс блока: **60%**

### D. Model Ecology

- [x] quality/latency/reliability tracking
- [x] configured state
- [x] cooldown
- [x] repeated failure circuit breaker
- [x] legacy-safe restore
- [ ] multi-tier Qwen mobile routing
- [ ] measured device-specific model benchmark
- [ ] shadow/model competition

Прогресс блока: **63%**

### E. Memory

- [x] persistent memory
- [x] lifecycle/governor layers
- [x] prediction ledger
- [x] epistemic ledger
- [ ] explicit belief expiration
- [ ] predictive memory cache
- [ ] model-memory separation benchmark

Прогресс блока: **68%**

### F. Learning

- [x] P30 continual learning
- [x] trajectory/replay infrastructure
- [x] world-model learning pieces
- [x] plasticity/governance pieces
- [ ] general cross-domain transfer benchmark
- [ ] failure→learning longitudinal benchmark

Прогресс блока: **60%**

### G. Agency / Goals

- [x] autonomous cycles
- [x] goal ecology
- [x] constitutional arbitration
- [x] self-development structures
- [ ] independently generated long projects with external validation
- [ ] project-level skill acquisition metric

Прогресс блока: **67%**

### H. Reality Research

- [x] P32 causal structures
- [x] P38 research infrastructure
- [x] P52 counterfactual development
- [x] P57 observatory
- [x] P77 reality experiment OS
- [ ] controlled A/B intervention runner
- [ ] replication/falsification loop
- [ ] external-source trust hierarchy

Прогресс блока: **63%**

### I. Self / Identity

- [x] self-model components
- [x] identity continuity
- [x] personhood structures
- [x] autobiographical layers
- [ ] self-prediction benchmark
- [ ] identity causal continuity benchmark
- [ ] conflict-aware value model

Прогресс блока: **62%**

### J. Embodiment / Perception

- [x] body runtime
- [x] telemetry
- [x] native audio features
- [x] native image features
- [x] semantic perception interfaces
- [ ] actual vision backend
- [ ] robust ASR/TTS integration benchmark
- [ ] cross-modal grounding benchmark

Прогресс блока: **58%**

### K. Architecture Consolidation

- [x] canonical source separation
- [x] legacy isolation audit
- [ ] OrganismCore decomposition
- [ ] seven subsystem APIs
- [ ] shared evidence/event spine across core subsystems
- [ ] removal of duplicate P-layer control logic

Прогресс блока: **35%**

### L. Long-Horizon Reliability

- [x] restart persistence
- [x] checkpoint governance
- [x] operational journal
- [x] replay tools
- [x] long-horizon tests exist
- [ ] 24h operational run
- [ ] 72h run
- [ ] 7d run
- [ ] 30d run

Прогресс блока: **52%**

### M. Consciousness Research

- [x] functional consciousness model
- [x] truthfulness constraints
- [x] lesion tests
- [x] temporal/embodied components
- [ ] longitudinal evidence corpus
- [ ] independent evaluation protocol
- [ ] rigorous perturbation study

Прогресс блока: **45%**

---

## 8. Прогресс всего большого плана

Это инженерная оценка состояния программы после этого прохода, а не ``consciousness score``. Для 34.4.0 дополнительно учитываются shared budget execution, corrected P65 prediction semantics, evidence lineage persistence и stable facade boundary.

- общий implementation progress: **58%**
- mobile readiness: **63%**
- runtime robustness: **70%**
- persistence: **86%**
- test infrastructure: **83%**
- memory architecture: **68%**
- learning architecture: **60%**
- agency: **67%**
- reality grounding: **63%**
- perception: **58%**
- self/identity: **62%**
- social cognition: **40%**
- native Android lifecycle: **20%**
- autonomous research: **55%**
- evidence quality: **57%**
- architectural consolidation: **35%**
- consciousness research readiness: **45%**

---

## 9. Насколько выполнен мой предыдущий аудит

### Сделано в этом проходе

- исправлен adaptive sensor scheduling;
- исправлен P40 failure handling;
- исправлен P40 migration hazard;
- исправлен synthetic/internal vs external evidence label;
- усилен Android telemetry;
- усилен Termux install contract;
- улучшен P41 native signal analysis;
- добавлен evidence integration spine;
- добавлен runtime diagnostics endpoint;
- создан machine-checkable progress audit;
- зафиксирован отдельный release report.
- server fallback-chain теперь передаёт P40 промежуточные backend failures.

### Осталось

- native Android host/lifecycle;
- полноценная semantic vision;
- social cognition;
- autonomous long-horizon projects;
- self-prediction benchmark;
- evidence trust hierarchy;
- model Olympics/shadow organism;
- OrganismCore decomposition;
- 24h/72h/7d/30d operational evidence;
- rigorous consciousness research.

Соответствие этому списку в текущем проходе: **≈75% рекомендаций приведены в действие или имеют уже существующий фундамент; ≈25% требуют следующих больших проходов.**

---

## 10. Что принципиально не делать

Не добавлять P83/P84/... только ради увеличения функционального списка.

Не считать внутреннюю оценку доказательством внешней реальности.

Не считать LLM главным мозгом.

Не запускать тяжёлую модель на каждом tick.

Не превращать phone runtime в постоянный CPU burner.

Не смешивать historical documentation с current release contract.

---

## 11. Самые сильные следующие большие проходы

### BIG STEP 36 — Cognitive Budget 2.0

Сделать общий resource economy для LLM, memory, simulation, research и reflection.

### BIG STEP 37 — Evidence/Prediction Spine 2.0

Связать Prediction Ledger, P65, P57 и Runtime Evidence Bus в один причинно-доказательный контур.

### BIG STEP 38 — OrganismCore decomposition

Разделить monolith без потери continuity/persistence.

### BIG STEP 39 — Autonomous Projects

Система получает задачу уровня проекта и самостоятельно проходит полный цикл от проблемы до внешнего подтверждения результата.

### BIG STEP 40 — Model Olympics + Shadow Organism

Конкурирующие predictive models и теневой неисполняющий агент.

### BIG STEP 41 — Real Android Body

Native host/lifecycle/sensors/camera/microphone.

### BIG STEP 42 — Social Mind

Память и prediction относительно конкретных других агентов.

### BIG STEP 43 — Longitudinal Organism

24h → 72h → 7d → 30d.

### BIG STEP 44 — Consciousness Research Protocol

Только после накопления длинной истории реальных данных.

---

## 12. Новые собственные идеи, сохранённые как архитектурные candidates

### Cognitive Immune System

Проверка входящих beliefs по provenance, contradiction, replication и source reliability.

### Dream Compiler

Сон как offline compiler episodic memory → skills/models/hypotheses, без автоматического превращения гипотез в факты.

### Model Olympics

Несколько world models предсказывают один поток будущего и конкурируют по реальному prediction error.

### Shadow Organism

Параллельный неисполняющий субъект для сравнения альтернативных решений.

### Cognitive Cache

L0/L1/L2/L3 память с predictive prefetch вместо простого retrieval.

### Pareto Commitments

Цели/ценности не всегда сворачиваются в один scalar; система может выбирать Pareto frontier конфликтующих обязательств.

### Cognitive Death

Beliefs/policies имеют жизненный цикл и могут быть сознательно сняты после систематической falsification.

### Information-Gain Economy

Действия оцениваются не только reward, но и ожидаемым уменьшением uncertainty.

---

## 13. Изменённые файлы и артефакты

Ключевые изменения: `src/organism/learning/P40ModelEcology.ts`, `src/organism/persistence/StateMigrations.ts`, `src/organism/system/PhoneRuntimePolicy.ts`, `src/organism/system/RuntimeEvidenceBus.ts`, `src/organism/system/ReleaseContract.ts`, `src/organism/core/OrganismCore.ts`, `src/organism/core/OrganismRuntime.ts`, `src/organism/body/AndroidEmbodimentBridge.ts`, `src/organism/cognition/P41NativePerception.ts`, `src/server/server.mjs`, `scripts/termux/install-from-download.sh`, `scripts/audit-big-pass-progress.mjs`, `tests/big-pass-35-hardening.mjs`, `VERSION.json`, `package.json`, `package-lock.json` и current release documentation.

## 14. Самое важное направление

Следующий скачок проекта должен измеряться не количеством функций, а количеством замкнутых циклов:

`prediction → action → real outcome → error → update → future improvement`

и

`surprise → hypothesis → experiment → evidence → belief revision → new goal`.

Именно такие циклы превращают Neuro-Kurisu из сложного набора когнитивных компонентов в развивающийся autonomous cognitive organism.


## 15. BIG PASS 36 — Budget/Evidence Spine 2

В 34.4.0 добавлено фактическое расходование cognitive budget по операциям (LLM/planning/simulation), persistence runtime evidence после restart, lineage integrity в Evidence Bus, corrected P65 prediction semantics (prediction vs actual вместо confidence vs actual), belief expiry/support lifecycle и тонкая facade-граница для постепенного выхода из OrganismCore monolith.

Отдельно зафиксирован regression-risk: длинные restart/long-horizon кампании не объявляются PASS без завершения; это остаётся эксплуатационным гейтом.
