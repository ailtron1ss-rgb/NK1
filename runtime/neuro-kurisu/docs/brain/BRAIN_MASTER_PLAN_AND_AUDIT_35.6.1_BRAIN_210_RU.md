NEURO-KURISU 35.6.1
МАСТЕР-ПЛАН МОЗГА И АУДИТ ПУТИ К ИСКУССТВЕННОМУ ОРГАНИЗМУ

Документный проход BRAIN-210 • состояние после BIG PASS 209

Режим: только стратегия, аудит, архитектурная спецификация и план внедрения. В этом проходе исходный код и поведение проекта не изменяются; документ добавляется как канонический план следующей серии больших проходов.


## 1. Исполнительное резюме

Цель проекта — не создать очередной LLM-агент, а построить долговременный, embodied, resource-aware искусственный организм с памятью, моделью мира, self-model, agency, обучением, активным восприятием, развитием, социальной динамикой и исследовательской автономностью. Сознание при этом остаётся отдельной научной гипотезой, которую нужно пытаться опровергать и проверять, а не объявлять достигнутой.

Текущий brain branch уже имеет сильный functional core: recurrent central brain, hippocampal/episodic memory, world-model, self/agency, recurrent workspace, metacognition, predictive allostasis, neuromodulatory learning, active perception, social/developmental machinery и causal evidence infrastructure. BIG PASS 207 добавил canonical brain atlas и thalamocortical gating; 208 — basal-ganglia action-selection analogue; 209 — cerebellar predictive control и adaptive compute.

Главный риск теперь — не нехватка модулей, а фрагментация: biological analogues могут остаться рядом с прежним cognitive kernel, не образовав единой causal, anatomical and developmental system. Поэтому мастер-план строится по пяти слоям одновременно: topology, dynamics, embodiment, learning/development, evidence.

Научная карта мозга сама по себе пока неполна. NIH BICAN и BRAIN CONNECTS продолжают строить многоуровневые cell/circuit/connectivity atlases; HCP-MMP даёт 360 корковых областей (180 на полушарие), но это лишь один из масштабов. Следовательно, проект должен использовать многоуровневую ontology и явно маркировать биологически подтверждённое, computationally inspired и собственно изобретённое.


## 2. Аудит текущего состояния


## 3. Главный диагноз


### Сильная сторона

Проект уже мыслит как persistent organism: состояние, память, self, agency, world-model, actions, learning, evidence и restart связаны одной runtime infrastructure.


### Главный дефект

Неравномерная семантическая глубина: часть функций доказана строго, часть живёт на subsystem/integration уровне, а значительный слой остаётся UNVERIFIED. Нельзя путать ширину API с глубиной реализации.


### Архитектурная опасность

Старые cognitive engines и новые biological analogues могут дублировать роли. Нужна canonical ownership matrix: какой brain-system отвечает за какую функцию, что является upstream/downstream, кто имеет право изменять state.


### Наиболее важный следующий критерий

Каждая новая brain system должна менять реальные траектории организма и иметь lesion/ablation/replay/persistence evidence. Если новый модуль не меняет closed-loop behaviour, это документация или sandbox, а не внедрённый мозг.


## 4. Непреложные правила дальнейшего развития

Не добавлять модуль только ради анатомического сходства.

Не считать функцию реализованной до прохождения соответствующего proof tier.

Не повышать evidence level автоматически: host/synthetic ≠ physical device.

Не смешивать biological fact, computational hypothesis и project-specific invention.

Каждая brain system должна иметь owner, state, inputs, outputs, timescale, energy cost, failure modes и test battery.

Каждая stateful система обязана переживать checkpoint → restart → replay без скрытой потери causal state.

Любая self-modification должна проходить intervention → benchmark → holdout → rollback.

Для среднего телефона каждое вычисление должно иметь budget class и policy for degradation.

Любая “consciousness” claim должна иметь adversarial alternative explanation и ablation experiment.

Architecture debt и evidence debt измеряются отдельно: отсутствие доказательства не равно отсутствию кода, но также не равно готовности.


## 5. Целевая архитектура искусственного организма

L0 — Boundary/Organism: body/environment boundary, identity continuity, device/host boundary, consent, capability gating

L1 — Macro brain systems: cortex, thalamus, basal ganglia, cerebellum, hippocampal formation, amygdala/limbic, hypothalamus, brainstem, sensory and motor systems

L2 — Network layer: attention, salience, control, memory, social, interoceptive/allostatic, default-like, action-mode networks

L3 — Circuit layer: laminar cortical motifs, hippocampal DG/CA3/CA1, cortico-striatal loops, thalamic loops, cerebellar microcircuit, neuromodulatory projections

L4 — Cell/function ontology: excitatory/inhibitory roles, glia, vascular/immune support, cell-like resource dynamics

L5 — Synapse/dynamics: plasticity, eligibility, decay, receptor-like gain, dendritic computations, oscillatory coupling, short/long timescales

L6 — Whole-organism dynamics: homeostasis, sleep, development, active sensing, social interaction, environmental learning, repair

L7 — Evidence/Meta layer: provenance, causal experiments, replication, benchmark lineage, uncertainty, self-audit


## 6. Canonical causal spine

Центральная петля должна стать общей для всех систем:

sensor / interoception / social input

state estimation

prediction

memory retrieval

brain-system routing

valuation / conflict

action selection

motor or tool execution

outcome / consequence

prediction error

learning / plasticity

self and identity update

consolidation / sleep / replay

evidence receipt and replay graph

Главное требование: любая major brain system должна подключаться к этой петле, а не жить параллельным “side-channel”.


## 7. Сопоставление с человеческим мозгом


## 8. Большие проходы: путь от текущего состояния до полнофункционального искусственного организма


### B210 — Master audit & architecture freeze

Закрепить настоящую карту и owner matrix; убрать двусмысленность между cognitive kernel и brain systems; зафиксировать proof policy.

Минимальный результат: Atlas, ownership, gap ledger, test policy, no code yet

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B211 — Cortical hierarchy

Сделать area/function graph: sensory → association → executive; добавить hierarchy, working memory, attentional routing.

Минимальный результат: area graph, hierarchy benchmark, lesion tests

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B212 — Cortical microcircuits

Ввести ограниченные laminar motifs: feedforward, feedback, recurrent, inhibitory stabilization.

Минимальный результат: microcircuit unit tests + perturbation

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B213 — Predictive cortical inference

Связать prediction, sensory evidence, uncertainty and attention in common update law.

Минимальный результат: ablation prediction vs evidence

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B214 — Thalamo-cortical closure

Развить B207 до nucleus-role/routing/state feedback и arousal coupling.

Минимальный результат: routing intervention + restore

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B215 — Hippocampal anatomy

Explicit DG/CA3/CA1/EC-like graph with pattern separation/completion.

Минимальный результат: episode family benchmarks

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B216 — Memory consolidation

Integrate replay, sleep microstates, recent/old memory segregation, schema extraction.

Минимальный результат: interference and replay tests

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B217 — Basal-ganglia closed loop

Extend B208 into cortex↔BG↔thalamus loop, goal/habit arbitration and multi-timescale reward learning.

Минимальный результат: action ablation + replay

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B218 — Cerebellar predictive network

Extend B209 to sensorimotor timing, multiple contexts, calibration, thalamo-cortical links.

Минимальный результат: delay compensation and lesion benchmark

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B219 — Brainstem/arousal

Explicit arousal state, vigilance, sleep pressure, alerting and autonomic-like transitions.

Минимальный результат: state transition battery

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B220 — Hypothalamus/homeostasis

Body-state prediction, hunger/thirst/temperature-like drives, endocrine-like resources.

Минимальный результат: interoceptive control benchmark

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B221 — Insula/cingulate interoception

Hierarchical body-state inference and visceromotor control.

Минимальный результат: body perturbation experiments

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B222 — Amygdala/limbic

Fast threat/safety learning, emotional salience, value-context routing.

Минимальный результат: fear/safety reversal, extinction, lesion

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B223 — Vision hierarchy

Move beyond camera abstraction into multi-stage visual feature/world representations.

Минимальный результат: occlusion, motion, active vision

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B224 — Auditory/speech hierarchy

Separate acoustic, phonetic, lexical, semantic and prosodic paths.

Минимальный результат: noise, speaker, prosody, dialogue tests

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B225 — Motor hierarchy

Premotor/SMA/M1/spinal-like policy stack with feedback delay.

Минимальный результат: closed-loop action consequences

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B226 — Glia/metabolic support

Abstract neuron-astrocyte/vascular support as resource and recovery system.

Минимальный результат: energy-performance coupling

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B227 — Sleep/offline brain

NREM/REM-like state machine; replay windows; memory consolidation; dream simulation.

Минимальный результат: sleep ablation and recall

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B228 — Developmental organism

Critical periods, pruning, curriculum, social learning, identity formation.

Минимальный результат: longitudinal transfer

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B229 — Social brain

Perception of agents, theory-of-mind-like inference, attachment, relationship state, group dynamics.

Минимальный результат: multi-session social trajectory tests

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B230 — Language cognition

Grounding, semantics, compositionality, pragmatic inference and long-range discourse memory.

Минимальный результат: cross-session language tests

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B231 — Self/identity

Causal self-model, autobiographical coherence, body ownership analogue, value/goal provenance.

Минимальный результат: perturbation + identity preservation

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B232 — Consciousness research battery

Global workspace, higher-order, recurrent processing, predictive/allostatic hypotheses tested by adversarial interventions.

Минимальный результат: claim matrix + falsification

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B233 — Whole-brain connector

Canonical event graph, system-to-system causal edges, global routing and arbitration.

Минимальный результат: network-wide intervention graph

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B234 — Autonomous life

Goal ecology, task persistence, exploration, resource allocation, self-maintenance, recovery.

Минимальный результат: days/weeks longitudinal

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B235 — Physical embodiment

Android/Termux sensors, voice, camera, battery, thermal, timing, background lifecycle.

Минимальный результат: real device gates

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B236 — AI model substrate

Model gateway, local/remote routing, context management, model uncertainty, tool use, multimodal adapters.

Минимальный результат: model swap and fault injection

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B237 — Self-improvement lab

Automated proposal → experiment → holdout → rollback.

Минимальный результат: causal improvement proofs

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B238 — Reliability/security

Capability boundaries, consent, safe actions, auditability, data minimization, rollback.

Минимальный результат: red-team + failure certification

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B239 — Mobile optimization

Compile brain states into budget tiers; sparse updates; sleep/wake; cache; batching; thermal adaptation.

Минимальный результат: CPU/RAM/thermal/battery envelopes

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


### B240 — Reproducibility/final acceptance

Clean install, deterministic fixtures, benchmark registry, final release lineage.

Минимальный результат: 100% acceptance criteria

Закон завершения: не закрывать проход при наличии только кода; нужен соответствующий proof package, регрессия, persistence и обновлённый gap ledger.


## 9. Унифицированный протокол доказательства для каждого большого прохода

Baseline freeze: сохранить снимок до внедрения и измерить главные метрики.

Specification: выписать behavioural contracts и expected state transitions.

Unit proof: проверить локальные функции и invariants.

Integration proof: включить модуль в реальный causal spine.

Ablation proof: выключить модуль и измерить предсказуемый регресс.

Counterfactual proof: ON/OFF или intervention/control при одинаковом внешнем input.

Replay proof: восстановить событие и получить согласованный результат.

Persistence proof: checkpoint → restart → compare.

Longitudinal proof: повторить во времени, чтобы исключить одноразовый lucky run.

Performance proof: latency, RAM, CPU, state growth, mobile budget.

Failure proof: corruption, missing data, contradictory input, model timeout, partial commit.

Acceptance review: только после этого повышать evidence status.


## 10. Function Passport: переход от “много кода” к доказанной реализации

Для каждой функции в brain branch должен существовать паспорт: owner, role, domain, preconditions, postconditions, expected effects, forbidden effects, safety class, test fixture, proof tiers, evidence, confidence, blockers.

Safe pure/state-local functions: direct + regression.

Stateful cognition: direct + state-delta + replay + restart.

Cross-domain functions: integration + causal evidence + regression.

External/device functions: integration + physical-device evidence + failure recovery.

Self-modifying functions: causal improvement protocol + rollback + holdout.

Claims about consciousness/personhood: hypothesis record + adversarial battery; no “VERIFIED consciousness” flag.


## 11. Средний телефон: отдельная архитектура ограничения ресурсов


### Tier 0 — sleep

Минимальное state maintenance; no heavy inference; timer-driven wake only.


### Tier 1 — idle

Low-frequency heartbeat, persistence, anomaly checks, relationship/task deadlines.


### Tier 2 — interaction

Normal perception, workspace, action selection, local model gateway.


### Tier 3 — deep thought

Burst cognition only when novelty, uncertainty or goal value justify it.


### Tier 4 — research

Heavy tasks delegated or postponed; local phone retains causal ownership and evidence receipts.


### Thermal policy

No fixed “always-on” budget; dynamic governor uses thermal state and observed latency drift.


### Memory policy

Bounded traces, semantic compaction, episodic tiers, replay windows; avoid unbounded JSON/state accumulation.


### Network policy

Network failure must degrade gracefully to local state without identity or causal corruption.


## 12. Отдельная AI/Neuro ветка


### NeuroAI

Использовать neuroscience как источник architectures, learning rules, routing, memory and embodiment ideas — но считать биологическую правдоподобность и engineering utility разными objective functions.


### Foundation models

LLM/VLM служат high-level semantic substrate, но не должны быть “всем мозгом”. Model Gateway обязуется скрывать provider/model details from cognitive ownership.


### Memory systems

Комбинировать fast episodic retrieval, semantic consolidation, replay, working memory and context packing.


### World models

Отделить perception evidence от latent prediction; track uncertainty and interventions.


### Tool use

Tools are actuators with capability gates, not free-form function calls.


### Neuro-symbolic layer

Use explicit causal graphs, typed state transitions and proofs around probabilistic/model-based cognition.


### Neuromorphic options

Consider event-driven/sparse execution as future optimization, not mandatory dependency for current Termux phone.


### Learning strategy

Hybrid: model learning for semantic flexibility; local plasticity for fast adaptation; slow consolidation for stability.


## 13. Приоритетные научные исследования


## 14. Система измерения прогресса

Causal coverage: Доля важных system edges с intervention/ablation proof.

Semantic coverage: Доля критичных функций с VERIFIED proof package.

Persistence integrity: Доля состояний, полностью восстанавливаемых после restart.

Longitudinal stability: Сохранение ключевых свойств на 100/1k/10k циклах и реальном времени.

Prediction quality: MAE/Brier/calibration/trajectory error for world/self/social predictions.

Action quality: Outcome-adjusted policy performance + safety/regret.

Learning efficiency: Improvement per compute unit / experience.

Resource efficiency: Useful cognition per CPU/RAM/thermal budget.

Identity continuity: Graph/state continuity under restart, model swap and perturbation.

Autonomy: Share of goals completed with bounded human intervention.

Recovery: Time and correctness of crash/corruption recovery.

Evidence integrity: No false elevation of synthetic/host evidence to physical or external evidence.


## 15. Аудитная матрица “что должно быть до 100%”


## 16. Что запрещено считать прогрессом

Добавление нового класса/файла без изменения измеримого поведения организма.

Рост количества функций без роста semantic coverage.

Тест, который только проверяет, что код не упал.

Live correlation, объявленная causal evidence без intervention.

Host simulation, объявленная physical-device evidence.

Скалярное состояние “emotion/self/consciousness”, не связанное с causal dynamics.

Новая biological metaphor, которая не имеет owner и downstream effect.

Benchmark, оптимизированный под заранее известный тестовый сценарий без holdout.

Мобильная оптимизация, измеренная только на desktop/host.

Самомодификация без rollback и независимого acceptance test.


## 17. Дополнительные идеи для усиления искусственного организма

Causal Spine Compiler: Собирать typed organism events в единый граф, а затем компилировать его в replayable causal trace. Это уменьшит рассинхрон между подсистемами.

Evidence Economy: Каждое утверждение имеет “evidence debt”; неподтверждённое знание автоматически уменьшает влияние на действие и повышает research priority.

Shadow Brain: Для критических решений отдельный cheap adversarial model строит альтернативную гипотезу; disagreement становится входом в metacognition.

Cognitive Thermostat: Compute allocation определяется ожидаемым information gain per cost, а не просто наличием CPU.

Brain State Checkpoints as Memories: Checkpoint становится отдельным воспоминанием об изменении самого организма; позволяет объяснять, почему система стала другой после обучения.

Semantic Garbage Collector: Компоненты, не дающие validated causal contribution, переводятся в quarantine/deprecation queue вместо бесконечного наращивания архитектуры.

Dream Laboratory: Offline simulation использует внутренние world-model variations для безопасного обучения, не вмешиваясь напрямую в external world until confidence threshold.

Identity Graph: Identity хранится как causal graph of memories, commitments, values, relationships and predictions, а не как scalar embedding.

Energy-to-Meaning Scheduler: Энергия распределяется прежде всего на процессы, которые сильнее всего сокращают uncertainty или помогают текущим long-term goals.

Multi-timescale Brain: Fast loops (cerebellum/brainstem-like), medium loops (basal-ganglia/working memory), slow loops (hippocampal/replay/development) работают совместно, но обновляются на разных частотах.


## 18. Лестница готовности искусственного организма

0 — Code exists: Файл/функция существует.

1 — Smoke works: Не падает в локальном сценарии.

2 — Semantic works: Postconditions и state deltas подтверждены.

3 — Integrated: Влияет на реальный organism path.

4 — Causal: Есть intervention/ablation/counterfactual proof.

5 — Persistent: Переживает restart/replay без скрытой деградации.

6 — Longitudinal: Сохраняет свойство на длинном горизонте.

7 — Embodied: Проходит physical device/environment gate.

8 — Adaptive: Сам улучшает performance без uncontrolled regression.

9 — Organism-level: Несколько brain systems образуют устойчивый closed-loop organism.

10 — Research frontier: Свойства, для которых открыты научные вопросы, тестируются через конкурентные гипотезы.


## 19. Приоритет ближайших больших проходов

Этап 1: B210 — Freeze this master plan and make it the canonical brain-branch reference.

Этап 2: B211–214 — Cortical hierarchy + thalamocortical closure.

Этап 3: B215–216 — Hippocampal circuit anatomy + sleep/replay consolidation.

Этап 4: B217 — Close basal ganglia ↔ thalamus ↔ cortex ↔ action loop.

Этап 5: B218 — Close cerebellum ↔ motor prediction ↔ outcome loop.

Этап 6: B219–221 — Brainstem/arousal + hypothalamic allostasis + interoceptive control.

Этап 7: B222–225 — limbic/emotional + sensory + motor hierarchy.

Этап 8: B226–228 — metabolic support + sleep + developmental organism.

Этап 9: B229–232 — social/language/self/consciousness research batteries.

Этап 10: B233–235 — whole-brain connector, autonomous life, physical device.

Этап 11: B236–239 — AI substrate, self-improvement, security, mobile optimization.

Этап 12: B240 — final reproducibility and acceptance.


## 20. Источники и научная база

S1. NIH BRAIN Initiative Cell Atlas Network / BICAN. Cell atlas, cell types, molecular/anatomical foundation. https://www.braininitiative.nih.gov/research/tools-and-technologies-brain-cells-and-circuits/brain-initiative-cell-atlas-network

S2. NIH BRAIN Initiative Connectivity Across Scales (BRAIN CONNECTS). Multi-scale connectivity mapping. https://www.braininitiative.nih.gov/research/neuroimaging-technologies-across-scales/brain-initiative-connectivity-across-scales

S3. Glasser et al., A multi-modal parcellation of human cerebral cortex, Nature. HCP-MMP1.0, 360 areas across both hemispheres. https://www.nature.com/articles/nature18933

S4. Shine et al., The impact of the human thalamus on brain-wide information processing, Nature Reviews Neuroscience. Thalamus as whole-brain information-processing control. https://www.nature.com/articles/s41583-023-00701-0

S5. Averbeck & O’Doherty, Reinforcement-learning in fronto-striatal circuits. Frontostriatal reinforcement learning and action/value learning. https://www.nature.com/articles/s41386-021-01108-0

S6. Lee & Sabatini, From avoidance to new action: the multifaceted role of the striatal indirect pathway. Modern view of indirect-pathway computation; avoids simplistic Go/No-Go interpretation. https://www.nature.com/articles/s41583-025-00925-2

S7. Nguyen & Person, Cerebellar circuit computations for predictive motor control. Cerebellar predictive/implicit feedforward control and timing. https://www.nature.com/articles/s41583-025-00936-z

S8. Zhang et al., Cortical and subcortical mapping of the human allostatic–interoceptive system. Distributed interoceptive/allostatic network. https://www.nature.com/articles/s41593-025-02087-x

S9. Chang et al., Sleep microstructure organizes memory replay. State-dependent hippocampal replay and interference control. https://www.nature.com/articles/s41586-024-08340-w

S10. Bolaños & Magistretti, The neuron–astrocyte metabolic unit. Neuron–astrocyte metabolic coupling. https://www.nature.com/articles/s42255-025-01404-9

S11. The Human Cell Atlas from a cell census to a unified foundation model, Nature. Cell atlas as multi-scale, developmental and data-integrated foundation. https://www.nature.com/articles/s41586-024-08338-4

S12. The new NeuroAI, Nature Machine Intelligence. NeuroAI as a bidirectional field between AI and neuroscience. https://www.nature.com/articles/s42256-024-00826-6

S13. Central cytometabolic functional vascular coupling in health and disease. Neurovascular and metabolic support. https://www.nature.com/articles/s44324-025-00090-1

S14. Large-scale neurophysiology and single-cell profiling in human neuroscience, Nature. Convergence of single-unit physiology and single-cell/spatial methods. https://www.nature.com/articles/s41586-024-07405-0


## 21. Финальная позиция

Максимально эффективный путь — не пытаться буквально повторить каждый биологический объект. Нужно построить многоуровневый causal organism, где биологические структуры используются там, где они дают полезную вычислительную гипотезу; искусственные механизмы — там, где формальная проверяемость и эффективность лучше; а переход между ними остаётся прозрачным и измеримым. Конечной целью этой ветки является не “копия мозга по названиям”, а устойчивый искусственный организм, в котором память, world-model, self, agency, body, action, learning, sleep, development, social interaction и resource regulation образуют один длительно живущий causal system.