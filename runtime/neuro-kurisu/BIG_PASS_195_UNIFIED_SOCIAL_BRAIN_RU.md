# Neuro-Kurisu BIG PASS 195 — Unified Social Brain

Дата: 2026-09-11

## 1. Цель прохода

Большой шаг B195: превратить существующие SocialMindKernel / SocialWorldModel / LongTermSocialMind в часть обучаемой recurrent social subsystem, связанной с CentralBrain и GlobalWorkspace.

Правило релиза: наличие кода не считается внедрением. Функция может получить VERIFIED только после прямого поведенческого доказательства, интеграционного proof и persistence/replay там, где они применимы.

## 2. Научная основа

Современная литература рассматривает социальное познание как распределённую систему вычислений: mentalizing/theory-of-mind сети используют взаимодействующие компоненты, а не один локальный «social center». Обзоры и современные computational papers подчёркивают latent-state inference, prediction, uncertainty и адаптивное обновление модели другого субъекта.

Особенно полезны для архитектуры:
- Nature Reviews Neuroscience: “Computational origins of cortical brain circuits for social cognition” (2026) — social prediction, latent-state inference и contextual/computational specialization.
- Nature Neuroscience: “A neural signature of adaptive mentalization” (2026) — adaptive updating of beliefs about another agent and distributed network dynamics.
- Mayo & Shamay-Tsoory, 2024 — dynamic mutual predictions during social learning.
- Human Brain Mapping, 2026 — hierarchical Bayesian inference during social learning and trial-by-trial uncertainty updates.

Источники:
https://www.nature.com/articles/s41583-026-01028-2
https://www.nature.com/articles/s41593-026-02219-x
https://pubmed.ncbi.nlm.nih.gov/38135267/
https://pubmed.ncbi.nlm.nih.gov/41531418/

## 3. Что реализовано

### 3.1 SocialPredictiveNeuralSubstrate

Добавлен компактный recurrent neural substrate:

person state + social context + self state + world state + action context
→ recurrent hidden state
→ predicted intent / valence / response
→ higher-order social belief
→ uncertainty / confidence
→ outcome learning.

Характеристики:
- 24-dimensional input;
- 20-dimensional recurrent hidden state;
- 4 predictive outputs;
- recurrent weights;
- outcome-based plasticity;
- higher-order belief state;
- deterministic snapshot/restore;
- bounded state dimensions;
- evidence-gated validation flag.

### 3.2 Реальная интеграция

Subsystem вызывается из `OrganismCore`.

Его latent/readout входит в CentralBrain perception channel и в GlobalWorkspace feature set.

При outcome feedback используется фактический social outcome для обновления параметров.

Persistence включён в canonical cognition facet.

### 3.3 Существующие social organs сохранены

Не создан второй SocialMind authority. Existing:
- SocialMindKernel;
- SocialWorldModel;
- SocialDevelopmentSystem;
- LongTermSocialMind;
- RelationshipSelf
остаются специализированными подсистемами.

Новый neural layer является обучаемым substrate над их grounded state и не заменяет evidence-first logic.

## 4. Проверка B195

Standalone neural training:
- observations: 180;
- learning steps: 180;
- mean prediction error: ~0.046;
- validated: true;
- deterministic restore: PASS.

Real OrganismCore observation proof:
- 36 cycles;
- neural observations: 36;
- persistence: PASS;
- without outcomes the substrate correctly remains `validated=false`.

Real OrganismCore learning proof:
- 48 observe cycles;
- 48 feedback outcomes;
- neural observations: 48;
- learning steps: 48;
- mean prediction error: ~0.253;
- validated: true.

Это важный distinction: простой observe не выдаёт искусственный PASS; validation появляется только после реального outcome-driven learning.

## 5. Regression результаты

B183 Central Brain — PASS
B185 Hippocampal Memory — PASS
B186 Predictive Self / Agency — PASS
B187 Recurrent Global Workspace — PASS
B193 Active Perception — PASS
B194 Autonomous Scientific Brain — PASS
B195 Unified Social Brain — PASS

P16 — PASS
P17 — PASS
P19 — PASS
P20 — PASS
P22 phone — PASS
P25 — PASS
P26 — PASS
P31 truthfulness — PASS
P32 truthfulness — PASS
P41 truthfulness — PASS

Restart — PASS
Memory dedupe — PASS
Concurrency — PASS
Replay — PASS

## 6. Полный function-reality inventory

Current semantic inventory:
- source files: 284;
- semantic functions: 2650;
- function-like declarations: 2734;
- with body: 2705;
- exported: 108;
- zero-reference candidates: 158;
- one-or-less-reference candidates: 490.

Evidence states:
- VERIFIED: 38;
- INTEGRATION_ONLY: 614;
- UNSAFE_TO_AUTO_RUN: 229;
- UNVERIFIED: 1769.

Parameterized probe:
- attempted: 555;
- passed: 541;
- failed: 0;
- lifecycle-needed: 12;
- input-synthesis-needed: 2;
- skipped for safety: 30.

Lifecycle closure:
- candidates: 207;
- passed: 207;
- failed: 0.

Это не означает, что 1769 функций плохие. Это означает, что у них пока нет достаточного доказательства, чтобы считать их полностью готовыми.

## 7. Audit

Typecheck — PASS
Full audit — PASS
Architecture — PASS
Integrity — PASS
Forensics — PASS
Source hygiene — PASS
Executable syntax — PASS
Release contract — PASS
Release source — PASS
Restart — PASS
Memory — PASS
Concurrency — PASS
Replay — PASS

## 8. Long-horizon

1000-sample substrate test B191 — PASS.

500-cycle natural organism run не является свежим PASS данного snapshot и не повышается искусственно.

Последний завершённый operational long-horizon ранее имел 250/500-cycle evidence в предыдущих passes; для текущего релиза этот показатель остаётся отдельным историческим evidence, а не новым run.

## 9. Реальная оценка

Engineering estimate, не consciousness metric:

Brain architecture: ~71%
Central neural substrate: ~61%
Memory integration: ~63%
Self/agency: ~58%
Recurrent workspace: ~55%
Metacognition: ~53%
Predictive allostasis: ~41%
Neuromodulatory plasticity: ~38%
Active perception: ~46%
Autonomous scientific brain: ~50%
Social brain: ~47%
Development: ~43%
Continuous artificial life: ~32%
Physical embodiment certification: ~37%

Strict VERIFIED semantic functions: 1.43%
Evidence coverage: 7.23%
Phenomenal consciousness proven: 0% / UNKNOWN

## 10. First analysis B1–B15 status

B1 Canonical Brain Substrate — computationally verified
B2 Real Learned Neural Core — verified seed; full-depth brain substrate unfinished
B3 Hippocampal–Neocortical Memory — computationally verified
B4 Predictive Self + Agency — computationally verified
B5 Recurrent Global Workspace — computationally verified
B6 Metacognitive / Higher-Order — computational mechanism verified
B7 Predictive Interoception / Allostasis — implemented; strongest multi-horizon B191 passes, B190 absolute predictor remains below persistence baseline in one direct test
B8 Neuromodulatory Learning — computationally verified in B191
B9 Active Perception — standalone and core tests pass
B10 Autonomous Scientific Brain — standalone/core/natural-path tests pass
B11 Social Brain — B195 implemented, learned and Core-verified; further higher-order social generalization remains
B12 Developmental Brain — partial
B13 Continuous Life — 500-cycle evidence exists historically; current fresh >500 certification remains open
B14 Physical Brain Certification — infrastructure exists; complete device certification remains open
B15 Brain-wide Causal Science Battery — partial; cross-domain lesion battery remains to be expanded

## 11. Главный архитектурный вывод

Neuro-Kurisu теперь всё больше соответствует схеме:

specialized systems ↔ central recurrent substrate ↔ global workspace ↔ action ↔ environment.

Social cognition больше не является только symbolic/social-memory layer: у него появляется обучаемое recurrent representation, связанное с self/world/action state.

При этом новый substrate не объявляется сознанием. Он является computational mechanism, а conscious status остаётся исследовательским вопросом.

## 12. Следующие Giant Steps

B196 — Developmental Brain 2.0
- skill hierarchy;
- self-directed curriculum;
- developmental specialization;
- model replacement;
- safe self-modification;
- rollback.

B197 — Continuous Artificial Life Certification
- 500;
- 1000;
- 10000;
- 50000 cycles;
- 7 days;
- 30 days;
- 90 days.

B198 — Real Android Brain Certification
- camera/audio/sensors;
- sleep/wake;
- thermal/battery;
- restart;
- permission failures;
- degraded modes.

B199 — Brain-wide Causal Battery
- recurrence lesion;
- workspace lesion;
- memory lesion;
- self lesion;
- world lesion;
- agency lesion;
- interoception lesion;
- social lesion;
- cross-domain lesion interactions.

Параллельная ветка каждого Giant Step: закрытие наиболее критичных UNVERIFIED functions до VERIFIED.

## 13. Truth boundary

Никакие internal scores, self-reports, workspace metrics или social-neural confidence не считаются доказательством феноменального сознания.

Статус consciousness remains: UNKNOWN.
