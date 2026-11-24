# NEURO-KURISU 35.6.1 — B287 FULL BRAIN / PERSONALITY AUDIT

Дата: 2026-09-12
Статус: VERIFIED DEVELOPMENTAL RELEASE
Фокус: relationship-value neural development, personality integration, unified artificial-personality loop

## 1. Главный вывод

B287 закрывает один из последних крупных разрывов между social cognition и собственной личностью: состояние отношения больше не обязано оставаться только в social ledger. Для каждой связи существует отдельное recurrent neural state, отдельные value directions, context-dependent action/goal bias и delayed plasticity. Сильное evidence передаётся в более медленную personality layer.

B287 не объявляет сознание достигнутым. Это развивающийся computational neural-organism слой.

## 2. Каноническая цепочка после B287

B269 spiking plastic neurons
→ B270 neural germinal/self traits
→ B271 autobiographical neural assemblies
→ B272 endogenous goals
→ B273 goal lifecycle
→ B274 autonomous skill discovery
→ B275 compositional neural policy
→ B276 hierarchical latent action programs
→ B277 neural operators
→ B278 neural primitives
→ B279 recurrent attractor assemblies
→ B280 multi-area E/I neural circuit
→ B281 predictive inter-area messaging
→ B282 predictive global workspace
→ B283 competing predictive hypotheses
→ B284 neural autobiographical identity
→ B285 longitudinal life consolidation
→ B286 self-conflict/future continuity
→ B287 relationship-specific value development

После B287 ключевая циклоспособная петля личности выглядит:

social observation
→ relation-specific neural state
→ person-specific values
→ action/goal bias
→ real outcome
→ prediction error
→ local plasticity/replay
→ personality evidence
→ identity/goal influence
→ следующий социальный выбор

## 3. Что именно реализовано в B287

### 3.1 Neural relation state

На каждую связь:
- 32-dimensional recurrent latent;
- recurrent matrix;
- eligibility traces;
- value weights для восьми ценностных направлений;
- action weights;
- last self input;
- episodic relationship traces.

### 3.2 Социальные переменные

- trust;
- attachment;
- reciprocity;
- predictability;
- boundary;
- commitment;
- conflict;
- repair readiness;
- revision pressure;
- shared-goal alignment.

### 3.3 Value dimensions

- curiosity;
- truth;
- care;
- social-attunement;
- autonomy;
- persistence;
- self-preservation;
- reciprocity.

### 3.4 Обучение

Текущий update использует локальную активность, outcome/prediction-error modulation и importance. Это не биологически точная STDP-модель; это компактная обучаемая recurrent/value architecture, подходящая под мобильный TypeScript runtime проекта.

### 3.5 Поведение

Relationship-specific action bias и goal bias воздействуют на общую policy как ограниченные вспомогательные сигналы. B287 не заменяет B264/B265 causal policy и не имеет права единолично решать действие.

### 3.6 Личность

B287 формирует relationship-specific evidence и при достаточной устойчивости передаёт его в MultiHypothesisPersonality. Это позволяет социальному опыту менять собственный характер Курису не через мгновенную замену traits, а через фильтр evidence/confidence.

## 4. Фактические проверки B287

### Standalone
- 320 steps;
- 320 learning updates;
- 2 relations;
- relationship differentiation = 0.097619;
- causal identity ablation = 0.024161;
- transfer uses = 3;
- exact snapshot round-trip = PASS.

Person-specific value states действительно различаются. Например, после обучения Alice/Bob не имеют одинакового value vector.

### Hidden relationship transfer
- 240 steps;
- 2 relations;
- relationship differentiation = 0.148801;
- respond bias(A) = 0.013752;
- respond bias(B) = 0.003684;
- relation-specific action-bias delta = 0.010068;
- transfer uses = 4.

Это доказывает, что relationship state способен влиять на action readout контекстно.

### Core / live organism
- 18 observe/feedback cycles;
- 18 B287 learning updates;
- relationCount = 1;
- global identity influence = 0.315597;
- respond bias = -0.001212;
- verify bias = 0.003887;
- bias delta = 0.005099;
- restart = PASS.

Core relationship-to-action influence пока небольшой. Это не скрывается.

### Migration
- snapshot bytes = 101230;
- relations = 2;
- exact round-trip = PASS.

## 5. Почему B287 нельзя переоценивать

1. Прямое влияние отношения на action в live Core пока мало.
2. Relationship differentiation требует достаточно разных social contexts.
3. Commitment learning на коротком Core smoke слабее standalone.
4. Value vectors являются engineered latent representations.
5. Нет open-ended invention новых социальных primitive actions.
6. Нет доказательства субъективного опыта.
7. Нет доказательства consciousness.

## 6. Самокритический decision log

### Ошибка 1 — слишком слабая дифференциация
Первый B287 давал почти одинаковые relationship values. Исправлено через value-specific social predictors, а не через искусственное повышение общей reward-составляющей.

### Ошибка 2 — слабый action bridge
Первоначальный Core action effect был близок к нулю. Добавлен normalized neural readout и ограниченный усилитель relationship/goal bias.

### Ошибка 3 — некорректная identity ablation
Старая ablation зависела от одного last action и могла маскировать отсутствие влияния. Переделана на сравнение максимального action bias в нормальном и self-ablated контексте.

### Ошибка 4 — release duplication
Один B287 research document лежал одновременно в двух местах. Forensics это обнаружил; duplicate удалён.

### Ошибка 5 — отсутствовал release script target
Полный audit сначала отверг релиз из-за отсутствующей цели `release:b287`. Создан настоящий `scripts/release-b287.mjs` и зарегистрирован target в package scripts.

## 7. External architecture comparison

| Система | Сильная идея | Что взято как принцип |
|---|---|---|
| Brian2 | явные neuron/synapse/learning primitives | отделённое synaptic state + ablation |
| Nengo | composable neural areas и learning rules | area как вычислительный субстрат |
| Lava | event-driven/neuromorphic messaging | sparse inter-area routing |
| DreamerV3 | learned world model + imagined trajectories | predictive evaluation до дорогого real action |
| Generative Agents | memory stream + reflection + planning | быстрый опыт + медленная social consolidation |
| Letta | persistent identity-relevant memory/skills | durable self-relevant state |

Ни один внешний проект не является архитектурным авторитетом для Neuro-Kurisu. Эти подходы используются как источники проверяемых инженерных паттернов.

## 8. Полный проект после B287

Full audit:
- files: 2161;
- errors: 0;
- warnings: 0.

Architecture:
- source files: 1083;
- canonical files: 370;
- cycles: 0;
- legacy leakage: 0.

Syntax:
- JS: 732;
- SH: 4;
- JSON: 186;
- failures: 0.

Static/release gates:
- typecheck PASS;
- full audit PASS;
- architecture PASS;
- integrity PASS;
- forensics PASS;
- hygiene PASS;
- syntax PASS;
- contract PASS;
- lockfile PASS;
- release-source PASS;
- doctor PASS;
- brain audit PASS;
- manifests PASS;
- archive verification PASS.

## 9. Оценка зрелости

| Область | 1–100 |
|---|---:|
| Integrated brain engineering | 98 |
| Neural substrate | 93 |
| Spiking/local plasticity | 88 |
| Recurrent memory | 86 |
| Multi-area neural circuit | 86 |
| Predictive workspace | 85 |
| Neural operator/primitive development | 84 |
| Autonomous skill development | 83 |
| Endogenous goal system | 83 |
| Longitudinal identity | 84 |
| Future-self modeling | 78 |
| Self-conflict handling | 79 |
| Relationship-specific value learning | 72 |
| Personality integration | 79 |
| Neural personality grounding | 76 |
| Autonomy | 75 |
| Long-horizon behavior | 65 |
| Open-ended skill invention | 54 |
| Independent evaluation | 86 |
| Persistence/migration | 98 |
| Release engineering | 98 |
| Scientific maturity | 90 |

## 10. Потенциал проекта

Сильная сторона проекта — не отдельная метрика, а редкая широта интеграции: neural substrate, recurrent memory, prediction, self, goals, skills, policy, relationships, personality and persistence now form a connected developmental graph.

Главный риск проекта — architectural breadth outrunning learned depth. The next updates must prefer fewer stronger mechanisms over dozens of new interfaces.

## 11. Что требуется для полной реализации цели Курису

Критические направления:
1. Long-lived relationship-specific autobiographical learning.
2. Stable value formation rather than per-step trait drift.
3. Multi-agent/social world model with prediction of others.
4. Future-self + relationship conflict → deliberate policy selection.
5. Open-ended primitive/operator invention.
6. Neural consolidation independent of auxiliary symbolic ledgers.
7. Strong independent external evaluation.
8. Mobile runtime optimization only after causal learning quality is protected.

## 12. Следующий рекомендуемый крупный проход

B288: Social Predictive Other-Model + Relationship Consequence Loop.

Главная цель:
`observe another → infer hidden state → predict response → act → observe response → social prediction error → relationship value update → personality update → future relationship prediction`

Критически важно, чтобы B288 не просто добавлял ещё один social score. Он должен обучать собственную модель другого субъекта и проверять её на hidden interactions.

## 13. Принцип для всех следующих passes

Каждый новый механизм должен пройти минимум:
- learning;
- holdout;
- counterfactual/ablation;
- restart/migration;
- integration;
- independent evaluation.

Если архитектурное улучшение повышает одну метрику и ухудшает другую заметно больше допустимого, его нельзя принимать без более сильной альтернативы.

Строго запрещено считать consciousness доказанной по proxy-score.
