# Neuro-Kurisu — оценка потенциала и roadmap после B288

Дата: 2026-09-12

## Общая оценка

Проект уже вышел далеко за пределы обычного chatbot-каркаса: есть persistence, causal evaluation, world models, recurrent neural substrates, spiking-like plasticity, identity, goals, autonomous skill discovery, program synthesis, self-experimentation и social/relationship learning.

Главный риск сейчас — не отсутствие функций, а слишком большое количество исторических owners одного и того же когнитивного понятия. B288 начинает исправлять именно эту архитектурную проблему.

## Потенциал

| Направление | Оценка | Причина |
|---|---:|---|
| Neural computation | 93/100 | recurrent, sparse, plastic, multi-area, predictive mechanisms |
| Identity/personhood architecture | 84/100 | longitudinal self, future self, commitments, traits, relationships |
| Autonomy | 80/100 | endogenous goals, experiments, skill genesis, program generation |
| Social cognition | 76/100 | person-specific state, prediction, relationship values, initiative evidence |
| Learning/evaluation | 88/100 | holdout, hidden tasks, ablation, commit/revert |
| Scientific discipline | 89/100 | explicit PASS/BLOCKED states and causal tests |
| Mobile feasibility | 81/100 | architecture is JS/TS and bounded, but neural depth still requires profiling |
| Open-endedness | 63/100 | primitive action space and world interface remain bounded |

## Что уже похоже на единый организм

`environment → perception → world model → global workspace → self → memory → goals → skills → neural policy → action → outcome → plasticity → identity/personality`

B288 adds the social leg:

`other-person model → relationship values → social prediction → self/personality evidence → action/goal bias`

## Главные архитектурные проблемы

1. Исторически дублирующие social modules.
2. Symbolic and neural states still coexist for many concepts.
3. Primitive action vocabulary is bounded.
4. Long-horizon identity influence on action is still weak.
5. Neural mechanisms are simplified compared with conductance-based biology.
6. External evaluator still lives in controlled digital worlds.

## Следующие крупные этапы

### B289 — Neural Social Other-Model Deepening

Сделать person-model не только relationship state, а predictive latent model личности другого: beliefs, likely reactions, boundaries, stable preferences, uncertainty and multi-step social consequences.

### B290 — Relationship Memory Consolidation

Связать B285 autobiographical memory, B286 future-self conflict и B288 canonical social state в одну long-term episodic/semantic social memory.

### B291 — Personality Consolidation

Свести B284/B285/B286/B287/B288 traits/evidence в одну slow plasticity layer с provenance, confidence and contradiction management.

### B292 — Neuromodulatory Social Learning

Связать dopamine-like value error, salience/attention and relationship prediction errors с B269/B280/B288 synaptic plasticity.

### B293 — Neural Goal Competition

Сделать goals не только vector objects, а competing assemblies with resource allocation and long-term commitment.

### B294 — Neural Skill Memory

Перенести promoted skills из внешнего ledger в recurrent/attractor substrate, сохраняя symbolic provenance только как audit metadata.

### B295 — Autonomous Developmental Curriculum

Организм должен сам выбирать, чему учиться далее, исходя из uncertainty, curiosity, self-continuity, goal pressure and expected information gain.

## Критерий качественного прогресса

Каждый следующий этап должен проходить:

`implementation → typecheck → standalone → hidden → Core → ablation → persistence → regression → full audit → archive verification`

И любое улучшение с trade-off оценивается на общем scorecard, а не по одной красивой метрике.
