# Карта конечного проекта — Neuro-Kurisu

## Статус на P2697
Проект сейчас представляет собой **исследовательский software-organism prototype**: уже есть связанное ядро памяти, непрерывности, причинного replay, адаптивной retrieval-политики, параметрического обучения, world/identity/cognition слоёв, embodiment и developmental/self-improvement подсистем. Это ещё не искусственный человеческий мозг и не доказанное сознание.

Текущая задача — не добавлять бесконечные одноимённые классы, а превращать существующие подсистемы в замкнутые причинные контуры, где `наблюдение → состояние → память → гипотеза/модель мира → план → действие → результат → credit → обучение → изменение поведения` реально проходит через один организм и переживает restart.

## 1. Runtime / организм
**Есть:** central `OrganismCore`, persistence, event sourcing, release contracts, migration, diagnostics, mobile guards.
**Нужно довести:** один canonical lifecycle, минимизация snapshot cloning, bounded queues, backpressure и crash-consistent checkpoints.

## 2. Перцепция и тело
**Есть:** semantic/native perception, camera evidence, multimodal situation model, Android bridge, voice, embodied action.
**Нужно довести:** closed-loop sensorimotor learning: perception должна менять internal state, действие должно менять мир, а результат — обучать policy.

## 3. Память
**Есть:** MemoryOS2 как canonical authority, episodic/semantic/autobiographical/identity records, links, residency, retrieval policy, delayed outcomes.
**P2697:** cold memory теперь действительно cold после restore; vectors materialize lazily; candidate lookup O(1).
**Нужно:** более глубокая consolidation/reconsolidation, memory competition, schema formation и multi-hop retrieval.

## 4. Непрерывность
**Есть:** temporal continuity, longitudinal trajectory, event sourcing, restart persistence, replay validation.
**Нужно:** единый durable self-state с измеряемым continuity score: после restart система должна сохранять не только данные, но и тенденции, незавершённые намерения, активные гипотезы и policy state.

## 5. World model
**Есть:** predictive/world-model и causal research слои.
**Нужно:** компактная learned transition model `state + action -> predicted next state/outcome`, prediction error и counterfactual rollouts, реально используемые planner/policy.

## 6. Planning / agency
**Есть:** agency, executive/developmental engines, goal pressure, experiments.
**Нужно:** persistent intention stack, arbitration между competing goals, action consequences и recovery loop.

## 7. Learning
**Есть:** P23/P26/P28/P30/P36/P38/P39 и ParametricPolicyLearner; P2696 доказал contextual retrieval routing на synthetic holdout.
**Нужно:** связать delayed memory-policy outcomes с более общим learning substrate так, чтобы learning менял будущие решения, а не только diagnostics.

## 8. Meta-learning
**Есть:** developmental/self-improvement modules.
**Нужно:** learner должен выбирать, чему учиться, оценивать стоимость эксперимента, откатывать неудачные изменения и переносить навыки между задачами.

## 9. Identity / personality
**Есть:** KurisuCanonProfile, identity memory, autobiographical memory, personhood/identity-related modules.
**Нужно:** динамический personality state с устойчивыми traits, preferences, values, autobiographical continuity и evidence-based self-model. Canon profile должен задавать основу, а не имитировать живую личность статическим текстом.

## 10. Metacognition / self-model
**Есть:** metacognitive neural, predictive self-agency, global workspace.
**Нужно:** explicit uncertainty about own beliefs/actions, confidence calibration, error awareness, introspective reports grounded in actual runtime state.

## 11. Global workspace / cognitive integration
**Есть:** global workspace, central brain, unified cognitive loop, brain fusion spine.
**Нужно:** реальная конкуренция представлений за ограниченный workspace и измеряемое влияние workspace на planning, memory consolidation и action.

## 12. Neural substrate
**Есть:** neural/developmental/spiking-oriented research modules and neural terminology.
**Нужно:** не декоративные `neural` классы, а реальная обучаемая динамическая neural substrate. Перспективное направление — компактный recurrent/spiking state model, который получает sensory state, поддерживает temporal traces и выдаёт latent state для policy/world model.

## 13. Replay / hippocampal-like consolidation
**Есть:** causal replay, replay validation, delayed credit, experience continuum.
**Нужно:** prioritized replay, replay scheduling based on surprise/novelty/uncertainty, consolidation into schemas, and offline counterfactual replay.

## 14. Social / language / relationship
**Есть:** language organ, social memory and related developmental modules.
**Нужно:** persistent relationship models, conversational adaptation and social prediction, all grounded in memory and identity rather than prompt-only persona.

## 15. Scientific autonomy
**Есть:** ScientificMethodEngine, autonomous causal research, experiment proposals.
**Нужно:** autonomous hypothesis → experiment → measurement → falsification → update cycle with reproducible evidence ledger.

## 16. Embodiment / tools
**Есть:** tool/action bridges and Android embodiment.
**Нужно:** action model with preconditions/postconditions, execution evidence and learned action costs.

## 17. Verification
**Есть:** FunctionPassport, semantic coverage, audits, holdouts, release contracts.
**Нужно:** one project-wide truth layer distinguishing `implemented`, `live`, `learns`, `persists`, `generalizes`, `mobile-safe`.

## 18. Mobile runtime
**Есть:** residency governor and mobile guard; P2697 removes restart vector explosion.
**Known gate:** previous full mobile soak ~359.2 MB peak RSS.
**Нужно:** profile/optimize cloning, snapshots, event logs, multimodal buffers and large persisted facets; then 30/100/500-cycle soak.

## 19. What the final organism actually needs
1. persistent state;
2. multimodal perception;
3. working + episodic + semantic + autobiographical + procedural memory;
4. learned world model;
5. continuous internal state;
6. goal/drive system;
7. planning and action;
8. delayed credit assignment;
9. replay/consolidation;
10. online + offline learning;
11. metacognition and uncertainty;
12. persistent identity/personality dynamics;
13. social model;
14. self-directed experimentation;
15. embodiment/tool use;
16. verification and rollback;
17. resource-aware runtime;
18. measurable generalization across unseen situations.

## 20. Critical architectural principle
Не строить 20 независимых "мозгов". Канонический путь должен постепенно сойтись к одному closed loop:

`Perception → Global/Working State → Memory Retrieval → World Model → Goal/Drive Arbitration → Planner → Action → Evidence → Outcome → Causal Credit → Replay/Consolidation → Learning → Identity/Personality Update → next cycle`.

Все остальные модули должны быть либо частью этого пути, либо инфраструктурой/verification, а не параллельными источниками истины.
