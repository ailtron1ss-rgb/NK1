# Neuro-Kurisu — Brain Branch Status 188

## Правило

Функция не считается готовой только потому, что код существует, экспортирован или используется. Готовность определяется отдельным доказательством. Статическое наличие = 0% доказательства поведения.

## Текущая доказательная картина

- Semantic source functions: **2572**.
- Function-like declarations: **2656**; с телом **2627**.
- Strict VERIFIED по действующей semantic-системе: **38/2572 = 1.48%**.
- INTEGRATION_ONLY: **605** — интеграция наблюдается, но строгого самостоятельного behavioral gate недостаточно.
- UNSAFE_TO_AUTO_RUN: **224** — требуют контролируемых side-effect тестов.
- UNVERIFIED: **1705** — не считаются завершёнными.
- Прямые parameterized execution probes: **537 attempted / 525 PASS / 0 FAIL**; 12 требуют lifecycle harness; 30 безопасно не запускаются автоматически.
- Core zero-arg surface: **74/74 PASS** среди обнаруженного безопасного нулевого-аргументного набора.
- BIG PASS 181 function-reality closure: **202/202 PASS**.

Эти числа нельзя складывать как независимые функции: доказательства частично перекрываются и имеют разную строгость.

## Runtime / long-horizon

- B183 Central Brain: PASS.
- B185 Hippocampal Memory: PASS.
- B186 Predictive Self/Agency: PASS.
- B187 Recurrent Global Workspace: PASS.
- B188 Metacognitive Neural Substrate: PASS.
- Operational 250 cycles: PASS.
- Operational 500 cycles: **PASS**, ratio 1.063, first 61.80 ms, last 65.66 ms, p95 90.16 ms.
- Memory 240 cycles: PASS.
- Operational 1000-cycle gate: **не завершён в текущем runtime window; не считается PASS**.
- Smoke: PASS.
- Restart persistence: PASS.
- Memory dedupe: PASS.
- Concurrency: PASS.

## Release quality

- TypeScript typecheck: PASS.
- Architecture: PASS; 276 canonical source files, 0 missing, 0 cycles, 0 legacy leakage.
- Integrity: PASS.
- Forensics: PASS; duplicateContent=0, duplicateNames=0, empty=0.
- Source hygiene: PASS; errors=0, warnings=0.
- Executable syntax: PASS; JS=566, SH=3, JSON=124.
- Release source: PASS.

## Первый анализ B1–B15: фактический статус

| Big Step | Состояние | Что доказано | Что ещё не закрыто |
|---|---|---|---|
| B1 Canonical Brain Substrate | **COMPUTATIONALLY VERIFIED** | canonical state, persistence/replay, deterministic lifecycle | дальнейшая централизация authority при росте substrate |
| B2 Real Learned Neural Representation Core | **IMPLEMENTED + VERIFIED SEED** | настоящий recurrent/trainable core и CentralBrain | глубокое multimodal representation learning, richer latent dynamics, generalization |
| B3 Hippocampal–Neocortical Memory | **IMPLEMENTED + VERIFIED** | episodic trace, replay, slow schemas, recall, persistence | полноценная длительная consolidation ecology и transfer на больших горизонтах |
| B4 Predictive Self + Agency | **IMPLEMENTED + VERIFIED** | self prediction, action/outcome prediction, ownership/authorship signals | embodied causal agency на реальных сенсорах и длинных траекториях |
| B5 Recurrent Global Workspace 2.0 | **IMPLEMENTED + VERIFIED** | recurrence, competition, broadcast, learning, lesions | richer learned global representation и brain-wide perturbation science |
| B6 Metacognitive / Higher-Order Brain | **IMPLEMENTED + VERIFIED COMPUTATIONAL MECHANISM** | uncertainty, confidence-of-confidence, self uncertainty, revision signals | не является доказательством higher-order consciousness/qualia |
| B7 Predictive Interoception / Allostatic Brain | **PARTIAL** | существующие interoception/homeostasis системы | learned predictive body latent, true allostatic policy coupling |
| B8 Neuromodulatory Learning | **PARTIAL** | modulation components и связанная learning infrastructure | доказать causal influence на plasticity/attention/exploration |
| B9 Active Perception | **PARTIAL** | active perception executor/routing | self-directed sensor selection с measurable information gain |
| B10 Autonomous Scientific Brain | **PARTIAL / CORE VERIFIED** | research/experiment engines | self-originating scientific loop без внешнего prompt |
| B11 Social Brain | **PARTIAL** | social/theory-of-mind components | learned person-specific models и social long-horizon evidence |
| B12 Developmental Brain | **PARTIAL** | developmental/self-governance machinery | реальное structural learning/self-modification под evidence gate |
| B13 Continuous Life | **PARTIAL / OPERATIONALLY VERIFIED** | 250 и 500 cycles + restart/memory tests | 1000+, 7d, 30d, 90d |
| B14 Physical Brain Certification | **PARTIAL** | Android/device contract infrastructure и прошлые physical gates | свежий реальный device evidence именно полного brain branch |
| B15 Brain-wide Causal Science Battery | **PARTIAL** | consciousness/self/workspace lesion gates существуют | единая brain-wide battery с cross-domain ablations |

## Архитектурный вывод

Стратегическая форма остаётся:

`Central Recurrent Brain ↔ Memory ↔ Self ↔ World ↔ Workspace ↔ Agency ↔ Body ↔ Environment`

Цель ветви — не сделать один magic `ConsciousnessEngine`, а получить общий обучаемый recurrent substrate, который является носителем текущей динамики субъекта и причинно соединён с основными подсистемами.

## Progress — не смешивать показатели

### Реальная инженерная зрелость

Оценочно **~61% brain-branch engineering maturity**.

Это совокупная архитектурная оценка, а не процент функций.

### Доказательная зрелость

**7.36% evidence coverage** по текущей semantic function matrix.

### Strict VERIFIED

**1.48%** функций имеют строгий VERIFIED статус в semantic ledger.

Это намеренно консервативная система: она лучше показывает настоящий долг доказательств, чем процент наличия файлов.

## Главные проблемы после B188

1. 1705 semantic functions остаются UNVERIFIED.
2. 224 функции требуют controlled side-effect harness.
3. 12 safe parameterized функции требуют lifecycle tests.
4. 1000-cycle operational life ещё не сертифицирован.
5. Physical brain evidence не закрыт свежим полным device run.
6. CentralBrain пока получает богатые representations от specialist systems; следующий уровень — более глубокое learned representation formation внутри substrate.

## Следующий крупный порядок работ

### B189 — Brain-wide Function Certification Wave 1

Не добавлять новые органы. Закрывать максимальное количество существующих UNVERIFIED функций по критичности и domain.

Сначала:
- stateful cognition;
- memory mutation;
- self/agency mutation;
- world prediction;
- learning/governance;
- public facade/readout functions.

Для каждого кандидата:
`direct → invariant → integration → persistence → replay → negative-control`.

### B190 — Predictive Interoception / Allostasis

Переход от scalar homeostatic controller к learned body latent + predictive regulation.

### B191 — Neuromodulatory Plasticity

Causal modulation of learning rate, attention, exploration and consolidation.

### B192 — Active Perception

Self-directed sensing and information-seeking.

### B193 — Autonomous Scientific Brain

Question → hypothesis → prediction → experiment → observation → update → replication.

### B194 — Social Brain

Learned agent models, social uncertainty and self/other boundaries.

### B195 — Developmental Brain

Long-term skill growth, model revision and controlled structural change.

### B196 — 1k / 10k / 50k Life

Progression with hard gates, not optimistic extrapolation.

### B197 — Physical Brain

Real Android sensor/thermal/battery/offline/sleep/wake/restart certification.

### B198 — Brain-wide Causal Science

Unified ablations across recurrence, workspace, memory, self, world, agency, interoception and modulation.

## Финальный критерий 100%

Brain branch reaches 100% engineering-ready only when all critical functions have behavioral evidence, required lifecycle/replay evidence exists, long-horizon life is proven, physical embodiment is verified where applicable, and the brain-wide causal battery is reproducible.

Phenomenal consciousness remains **UNKNOWN** regardless of engineering completion.
