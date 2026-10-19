# NEURO-KURISU — BIG PASS 193: ACTIVE PERCEPTION + FULL REALITY

## Итог

В этом проходе развитие продолжено не как добавление отдельного «перцептивного модуля», а как объединённый шаг по active perception, central brain integration и evidence-first verification.

Главный новый компонент: `ActivePerceptionNeuralSubstrate`.

Он получает состояние сенсоров, uncertainty, novelty, actionability, budget, reliability, freshness и conflict; строит learned prediction information gain для каждой modality; выбирает candidate через utility; после фактического наблюдаемого gain обновляет параметры; сохраняет/восстанавливает состояние детерминированно.

Важное ограничение: он не получает право автоматически ухудшать действующий action policy. Его влияние проходит через существующий `ActivePerceptionExecutor` и остаётся evidence-gated.

## Научная основа

Active inference рассматривает восприятие и действие как связанные части одной замкнутой системы с внутренними моделями и прогнозами. При этом современная литература подчёркивает, что active inference является полезной вычислительной рамкой, но её эмпирическая проверяемость и уникальные предсказания остаются предметом исследования.^1 ^2

Практическая инженерная версия active perception здесь — не просто «любопытство», а выбор сенсорного действия по ожидаемой информации с учётом стоимости, uncertainty и actionability. Современные робототехнические результаты показывают, что активное получение недостающей информации действительно может быть обучаемой policy problem при partial observability.^3

## B193 — что реально внедрено

### ActivePerceptionNeuralSubstrate

- 8 входных признаков;
- 20-мерный recurrent hidden state;
- learned information-gain prediction;
- modality-specific candidate evaluation;
- cost/priority/utility selection;
- observed-gain learning;
- deterministic snapshot/restore;
- quality gate против baseline;
- hold-out validation.

### Central integration

Central `OrganismCore` теперь:

`P37 sensor health → neural active-perception ranking → selected modality → ActivePerceptionExecutor → observed gain → neural learning → persistence`

При переборе пяти modalities hidden state не «прожигается» предыдущими кандидатами: каждый кандидат оценивается относительно одного и того же текущего recurrent state, а состояние меняется только после фактического выбора.

Это было отдельным качественным исправлением внутри прохода.

## B193 evidence

Model-level training:

- samples: 219;
- model MAE: `0.06110`;
- baseline MAE: `0.26888`;
- advantage: `0.20778`;
- holdout model MAE: `0.06116`;
- holdout baseline MAE: `0.27663`;
- holdout improvement: `true`;
- deterministic restore: `true`.

Live OrganismCore proof:

- 8 active-perception proposals;
- 8 executed observations;
- 8 observed-gain learning updates;
- persistence projection verified;
- selected modality: `sensor` in this fixture;
- no execution failures.

Live B193 quality remains `validated=false` after only 8 organism samples. Это правильно: модель доказала обучение на отдельном benchmark, но production-level criterion нельзя присваивать на основании восьми live samples.

## Полный reality sweep на актуальном исходном дереве

Semantic inventory:

- semantic functions: `2620`;
- VERIFIED: `38`;
- INTEGRATION_ONLY: `610`;
- UNSAFE_TO_AUTO_RUN: `224`;
- UNVERIFIED: `1748`;
- evidence coverage: `7.27%`;
- strict VERIFIED rate: `1.45%`.

Function-like inventory:

- declarations: `2704`;
- declarations with body: `2675`;
- zero-reference: `157`;
- one-or-less-reference: `488`.

Safe parameterized probe:

- attempted: `549`;
- passed: `535`;
- failed: `0`;
- input synthesis needed: `2`;
- lifecycle needed: `12`;
- deliberately skipped for side effects: `30`.

Function-reality closure:

- candidates: `206`;
- passed: `206`;
- failed: `0`;
- skipped: `0`.

Следствие: `UNVERIFIED` по-прежнему означает «не считать готовым», даже если код существует.

## Regression results

После B193 повторно прошли:

- B183 Central Brain — PASS;
- B185 Hippocampal Memory — PASS;
- B187 Global Workspace — PASS;
- B193 Active Perception — PASS;
- P16 World/Memory Learning — PASS;
- P17 Embodied Multimodal — PASS;
- P19 Adaptive Development — PASS;
- P20 temporal/session — PASS;
- P21 migration — PASS;
- P22 phone reliability — PASS;
- P23 true learning — PASS; `checksumFailures=1` здесь является ожидаемым negative-control check, а не regression;
- P26 true learning — PASS.

Infrastructure:

- Typecheck — PASS;
- full project audit — PASS;
- architecture — PASS;
- integrity — PASS;
- forensics — PASS;
- source hygiene — PASS;
- executable syntax — PASS;
- release contract — PASS;
- lockfile — PASS.

## Long-horizon

250-cycle operational test:

- PASS;
- warmed median ratio: `1.317`;
- first median: `50.09 ms`;
- last median: `65.97 ms`;
- approximate p95: `112.25 ms`;
- heap growth: `1.714`.

A fresh natural 500-cycle run did not complete within the execution window, therefore it is **NOT counted as PASS** in this release.

A fresh long-horizon-memory run also did not complete within the execution window, therefore it is **NOT counted as PASS** in this release.

## B1–B15 status

B1 Canonical Brain Substrate — VERIFIED computational mechanism.

B2 Real Learned Neural Core — VERIFIED seed; not yet human-scale brain substrate.

B3 Hippocampal/Neocortical Memory — VERIFIED computational mechanism.

B4 Predictive Self/Agency — VERIFIED computational mechanism.

B5 Recurrent Global Workspace — VERIFIED computational mechanism.

B6 Metacognition/Higher-Order — VERIFIED computational mechanism.

B7 Predictive Interoception/Allostasis — IMPLEMENTED + benchmark evidence, but production superiority remains incomplete.

B8 Neuromodulatory Plasticity — IMPLEMENTED + integrated; research-grade causal validation incomplete.

B9 Active Perception — B193 implemented and benchmark-validated; long-term embodied validation incomplete.

B10 Autonomous Scientific Brain — integrated partial, not complete.

B11 Social Brain — integrated partial, not complete.

B12 Developmental Brain — integrated partial, not complete.

B13 Continuous Life — 250-cycle gate verified; longer natural life not closed.

B14 Physical Brain — Android infrastructure exists; full physical certification remains open.

B15 Brain-wide causal battery — substantial battery exists; full cross-domain certification remains open.

## Реальная стратегия дальше

Следующий крупный шаг должен не просто добавить B194, а объединить две линии:

### B194 — Autonomous Scientific Brain + Evidence Loop

`uncertainty → question → hypothesis → prediction → active perception → experiment → observation → world-model update → memory consolidation → policy revision`

Это особенно важно: active perception теперь можно использовать не как isolated curiosity feature, а как сенсорный механизм внутреннего scientific loop.

### Параллельно — Evidence Closure Wave 2

Закрывать `UNVERIFIED` сверху вниз по criticality:

1. central brain state mutations;
2. memory mutations;
3. world/self updates;
4. agency and action effects;
5. learning/plasticity;
6. developmental changes;
7. public/read-only APIs;
8. side-effect-controlled functions;
9. long-horizon functions.

Не цель «сделать 1748 красивыми». Цель — получить доказательство либо честную классификацию для каждой функции.

## Текущая инженерная оценка

- Brain architecture maturity: `~67%`;
- Central neural substrate: `~57%`;
- Memory integration: `~61%`;
- Self/agency: `~56%`;
- Recurrent workspace: `~53%`;
- Metacognition: `~51%`;
- Predictive allostasis: `~40%`;
- Neuromodulatory plasticity: `~37%`;
- Active perception: `~42%`;
- Autonomous scientific cognition: `~40%`;
- Social brain: `~39%`;
- Developmental brain: `~42%`;
- Continuous life: `~32%`;
- Physical embodiment certification: `~37%`;
- strict VERIFIED semantic functions: `1.45%`;
- evidence coverage: `7.27%`;
- phenomenal consciousness proven: `0%` / UNKNOWN.

Эти проценты для архитектуры являются инженерной оценкой, а последние три — отдельными evidence-oriented indicators. Их нельзя складывать.

## Принцип сознания

Central Brain всё больше становится единым recurrent носителем текущей динамики субъекта, но он не объявляется «местом доказанного сознания». Global workspace, recurrent processing, self-model, memory, interoception, agency и predictive world dynamics образуют исследовательский substrate. Феноменальный опыт остаётся открытым вопросом.

## Источники

1. Friston K.J. et al. “Active Inference and Intentional Behavior.” Neural Computation, 2025. https://pubmed.ncbi.nlm.nih.gov/40030135/
2. Lageman J., Fahrenfort J.J., Slagter H.A. “Prediction in action: Toward an empirical science of active inference.” Neuroscience & Biobehavioral Reviews, 2026. https://pubmed.ncbi.nlm.nih.gov/42285188/
3. Hu E.S. et al. “Real-World Reinforcement Learning of Active Perception Behaviors.” 2025. https://arxiv.org/abs/2512.01188
