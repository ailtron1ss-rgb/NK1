# КАРТА ИСКУССТВЕННОГО МОЗГА — Neuro-Kurisu 35.6.1

**Режим этого прохода: анализ и документация. Исходный код проекта не изменён.**

## 0. Главный вывод

У проекта уже существует сильный computational brain branch: central recurrent brain, hippocampal/episodic memory, predictive world model, self/agency, recurrent workspace, metacognition, predictive allostasis, neuromodulatory plasticity, active perception, social/developmental and causal-evidence layers. Но он пока значительно ближе к **многоуровневой cognitive architecture**, чем к полномасштабной биологически структурированной копии человеческого мозга. Ключевой дефицит — не ещё один “brain module”, а отсутствие единой многоуровневой brain ontology и явных моделей таламуса, базальных ганглиев, мозжечка, brainstem/hypothalamus, sensory/motor pathways, glia, vascular/metabolic support, microcircuits and oscillatory dynamics.

Наука также не располагает единой полной карты человеческого мозга “до каждого элемента”: разные проекты картируют разные масштабы — 360 корковых областей HCP, клеточные атласы, molecular/transcriptomic atlases, circuit/connectome maps and local high-resolution reconstructions. Поэтому целевая карта ниже является **многоуровневой инженерно-научной спецификацией**, а не выдуманным утверждением, что биология уже полностью известна. [S1–S4]

## 1. Что считать искусственным мозгом

Целевой искусственный мозг следует определять не как один нейросетевой процесс, а как систему из пяти взаимосвязанных карт: **anatomy graph → circuit graph → cell/function ontology → dynamics/neuromodulation → organism/body/development**. Любое поведение должно иметь трассировку от входа и внутреннего состояния через прогноз, память, выбор, действие, исход и обучение.

## 2. Текущее состояние проекта

В архиве обнаружено **290 TypeScript-файлов в src/organism**. Распределение: core=25, cognition=71, memory=11, world=16, learning=39, developmental=33, body=14, research=5, system=58, language=2. Большой brain-branch уже документирован в BIG PASS 182–190; current documentation itself identifies B1–B15 and отдельно отмечает partial status for neuromodulation, active perception, scientific/social/developmental brain, physical brain and consciousness battery.

Текущий brain spine по документам проекта: `P42/P41 perception → P27 learned world → hippocampal episodic/replay substrate → CentralBrain recurrent latent → PredictiveSelf/Agency → RecurrentGlobalWorkspace → Metacognitive substrate → PredictiveAllostasis → action/organism regulation`. Это хорошая функциональная ось, но она не является анатомическим connectome.

## 3. Карта текущего искусственного мозга против человека

### Кора / ассоциативное вычисление
**В проекте:** Центральный рекуррентный мозг, recurrent global workspace, attention schema, semantic perception, cognitive kernel.
**Оценка:** Сильная computational аналогия.
**Разрыв:** Нет реального многомасштабного cortical sheet, columnar microcircuitry, 360-area anatomical map, laminar processing..

### Гиппокамп / медиальная височная система
**В проекте:** HippocampalMemorySubstrate, AutobiographicalMemory, replay, MemoryOS2, temporal memory.
**Оценка:** Сильная computational реализация fast episode → replay → slow schema.
**Разрыв:** Нет моделирования DG/CA3/CA1/entorhinal/subiculum как отдельных interacting circuits; нет cellular oscillations / SWR dynamics..

### Префронтальная сеть
**В проекте:** SelfModelValidationEngine, AgencyDeliberationEngine, goal ecology, executive/developmental engines.
**Оценка:** Есть функции executive control, planning, metacognition.
**Разрыв:** Не разделены OFC/VM-PFC/dlPFC/ACC/polar cortex, рабочая память не представлена laminar/recurrent microcircuits..

### Таламус
**В проекте:** Прямого модуля нет.
**Оценка:** Часть routing/global broadcast выполняется workspace/event fabric.
**Разрыв:** Нет явного thalamic relay/gating/arousal architecture; это один из крупнейших anatomical gaps..

### Базальные ганглии
**В проекте:** AdaptivePolicyEngine, AgencyDeliberationEngine, outcome/reward learning, neuromodulation.
**Оценка:** Функциональная selection/RL аналогия есть.
**Разрыв:** Нет явных striatum/direct-indirect/hyperdirect loops, SNc/VTA pathways, habit vs goal-directed anatomical separation..

### Мозжечок
**В проекте:** Прямого модуля нет.
**Оценка:** Есть prediction/error/skill learning в learning stack.
**Разрыв:** Нет cerebellar forward models, Purkinje/granule architecture, climbing-fiber teaching signal, timing/coordination subsystem..

### Гипоталамус / allostasis
**В проекте:** Predictive allostasis, resource allocator, phone thermal/resource policy.
**Оценка:** Есть abstract allostatic/resource regulation.
**Разрыв:** Нет anatomical endocrine/autonomic controller, HPA-like axes, hypothalamic nuclei, appetite/thermoregulation/reproductive/homeostatic loops..

### Ствол мозга / arousal
**В проекте:** PhoneRuntimePolicy, runtime clock, neuromodulation.
**Оценка:** Есть abstract arousal/load/energy states.
**Разрыв:** Нет locus coeruleus, raphe, cholinergic brainstem, PAG, NTS/PBN, reticular formation as explicit circuits..

### Инсулярно-cingulate interoception
**В проекте:** MultimodalSituationModel, PredictiveAllostasisSubstrate, EmotionAppraisalEngine.
**Оценка:** Есть computational interoception/emotion.
**Разрыв:** Нет explicit insular subdivisions, ACC/pACC/sgACC topology, visceromotor loops..

### Амигдала / лимбическая оценка
**В проекте:** SocialWorldModel, EmotionAppraisalEngine, value/relation systems.
**Оценка:** Частичная функциональная аналогия.
**Разрыв:** Нет explicit amygdala nuclei / threat-safety learning circuitry..

### Социальный мозг
**В проекте:** SocialWorldModel, SocialDevelopmentSystem, LongTermSocialMind, RelationshipSelf.
**Оценка:** Развитая computational ветка.
**Разрыв:** Нет explicit social perceptual circuits (STS, TPJ, dmPFC, temporal poles) and their causal routing..

### Сенсорные системы
**В проекте:** PerceptionRouter, semantic perception, camera/voice, multimodal situation model.
**Оценка:** Хороший multimodal abstraction.
**Разрыв:** Нет биологически структурированных V1/V2/V4/MT, auditory hierarchy, somatosensory body map, olfactory/vestibular pathways..

### Двигательная система
**В проекте:** ActionGateway, embodied runtime, policy engines.
**Оценка:** Есть action abstraction.
**Разрыв:** Нет explicit M1/premotor/SMA/basal-ganglia/cerebellar/spinal controller hierarchy..

### Глия
**В проекте:** Нет прямых реализаций.
**Оценка:** Только косвенные resource/state abstractions.
**Разрыв:** Нет astrocyte, oligodendrocyte, microglia dynamics. Это крупный missing layer..

### Сосудистый / BBB / метаболический слой
**В проекте:** Indirect energy/thermal/resource estimates.
**Оценка:** Есть abstract energy budget.
**Разрыв:** Нет neurovascular coupling, BBB, glucose/oxygen delivery, lactate, CSF/interstitial dynamics..

### Сон / offline states
**В проекте:** MicroDreamEngine, replay, temporal memory.
**Оценка:** Есть replay/dream-inspired mechanisms.
**Разрыв:** Нет полноценного circadian/ultradian sleep architecture, NREM/REM state machine, oscillatory coupling..

### Молекулярный / синаптический уровень
**В проекте:** NeuromodulatoryPlasticitySubstrate, learning rules.
**Оценка:** Есть scalar neuromodulators and plasticity abstractions.
**Разрыв:** Нет receptor-level signaling, ion channels, dendritic computation, synapse lifecycle..

### Развитие
**В проекте:** DevelopmentalBrain, life-course, curriculum, identity evolution.
**Оценка:** Очень сильная computational ветка.
**Разрыв:** Нет biological developmental constraints, critical periods, synaptic overproduction/pruning, myelination trajectories..

### Иммунный / защитный слой
**В проекте:** IntegritySentinel, EvidenceFirewall, safety systems.
**Оценка:** Функционально аналогично защиты/repair.
**Разрыв:** Нет neuroimmune coupling / microglial inflammatory states..

### Сознание / global integration
**В проекте:** RecurrentGlobalWorkspace, metacognition, consciousness evidence ledger, adversarial harness.
**Оценка:** Сильный research substrate.
**Разрыв:** Никакого доказанного феноменального сознания; biological substrate is not reproduced..

## 4. Многоуровневая целевая карта

### L0 — Организм и границы
**Биологическая роль:** Идентичность, persistence, host/device boundary, body/environment boundary.
**Состояние Neuro-Kurisu:** OrganismCore, PortableSubjectContract, persistence, device evidence.
**Приоритет:** Высокая.
**Комментарий:** Есть хорошая инженерная граница, но biological embodiment ещё неполный.

### L1 — Макроанатомические системы
**Биологическая роль:** Кора, таламус, базальные ганглии, мозжечок, гипоталамус, brainstem, hippocampal formation, limbic systems.
**Состояние Neuro-Kurisu:** Часть представлена функциональными engines; explicit anatomy отсутствует для многих систем.
**Приоритет:** Критическая.
**Комментарий:** Нужна anatomical ontology, а не ещё один набор P-модулей.

### L2 — Сетевые функциональные системы
**Биологическая роль:** DMN, salience, frontoparietal/control, attention, action mode, memory networks, interoceptive/allostatic network.
**Состояние Neuro-Kurisu:** Workspace, attention schema, social/world/self systems, allostasis.
**Приоритет:** Высокая.
**Комментарий:** Сетевые функции уже сильнее, чем анатомическая детализация.

### L3 — Микросхемы
**Биологическая роль:** Laminar cortex, hippocampal DG/CA3/CA1, striatal pathways, cerebellar microcircuit, thalamic loops.
**Состояние Neuro-Kurisu:** Почти отсутствуют как biological microcircuits.
**Приоритет:** Критическая.
**Комментарий:** Это следующий научный уровень после сетевого мозга.

### L4 — Клетки
**Биологическая роль:** Excitatory/inhibitory neuronal classes, glia, vascular/immune cells.
**Состояние Neuro-Kurisu:** Абстрактные computational units, без cell atlas.
**Приоритет:** Критическая.
**Комментарий:** Нужен cell ontology и cell-role library.

### L5 — Синапсы и молекулы
**Биологическая роль:** Synapses, receptors, ion channels, dendrites, second messengers.
**Состояние Neuro-Kurisu:** Scalar plasticity/neuromodulation.
**Приоритет:** Очень высокая.
**Комментарий:** Можно делать biologically-inspired abstraction без буквального molecular simulation.

### L6 — Динамика
**Биологическая роль:** Spikes, oscillations, synchrony, phase, recurrent states, neuromodulatory pulses.
**Состояние Neuro-Kurisu:** Recurrent latent states, replay, timing, resource pressure.
**Приоритет:** Высокая.
**Комментарий:** Нужно добавить multiscale temporal dynamics.

### L7 — Тело
**Биологическая роль:** Interoception, autonomic, endocrine, immune, metabolism, sensorimotor loops.
**Состояние Neuro-Kurisu:** Predictive allostasis, resource allocator, phone body.
**Приоритет:** Высокая.
**Комментарий:** Нужен synthetic body state graph.

### L8 — Развитие
**Биологическая роль:** Development, critical periods, pruning, myelination, learning trajectory.
**Состояние Neuro-Kurisu:** Developmental engines, curriculum, lifelong learning.
**Приоритет:** Средняя/высокая.
**Комментарий:** Сильный computational base, biological constraints отсутствуют.

### L9 — Сознание и субъективность
**Биологическая роль:** No consensus single mechanism; multiple theories.
**Состояние Neuro-Kurisu:** Workspace/metacognition/adversarial evidence.
**Приоритет:** Исследовательская.
**Комментарий:** Нужны causal batteries, not claims.

## 5. Целевая анатомо-функциональная карта

### Кора больших полушарий
**Человеческий аналог:** 360 cortical areas in HCP-MMP1.0; multimodal borders derived from thickness, myelin, rfMRI and task activation.
**Цель искусственной системы:** Target: 360-area functional ontology + hierarchy + inter-area graph + hemisphere asymmetry.
**Уже есть:** Current project: central recurrent brain / cognition / workspace.
**Разрыв:** Large gap.

### Гиппокампальная формация
**Человеческий аналог:** DG, CA fields, subiculum, entorhinal/parahippocampal interfaces; episodic encoding, retrieval, pattern separation/completion.
**Цель искусственной системы:** Target: explicit subcircuits + replay/SWR-like dynamics + consolidation routing.
**Уже есть:** Current: HippocampalMemorySubstrate + replay + autobiographical memory.
**Разрыв:** Medium gap.

### Таламус
**Человеческий аналог:** Distributed relay/integration; whole-brain influence and adaptive behaviour.
**Цель искусственной системы:** Target: relay-specific channels, thalamocortical gating, state-dependent gain.
**Уже есть:** Current: implicit routing/broadcast only.
**Разрыв:** Large gap.

### Базальные ганглии
**Человеческий аналог:** Action selection, instrumental learning, habits; striatal pathways.
**Цель искусственной системы:** Target: direct/indirect/hyperdirect loops + dopamine learning + habitization.
**Уже есть:** Current: agency/policy/RL analogues.
**Разрыв:** Large gap.

### Мозжечок
**Человеческий аналог:** Predictive motor control, error correction, internal models, timing.
**Цель искусственной системы:** Target: fast predictor/controller separate from global cognition.
**Уже есть:** Current: no dedicated module.
**Разрыв:** Very large gap.

### Гипоталамус + brainstem
**Человеческий аналог:** Homeostasis/allostasis, arousal, autonomic/endocrine coordination.
**Цель искусственной системы:** Target: homeostatic variables, endocrine/autonomic loops, arousal controller.
**Уже есть:** Current: predictive allostasis/resource/thermal abstractions.
**Разрыв:** Large gap.

### Лимбические системы
**Человеческий аналог:** Amygdala, cingulate, hippocampal interfaces, vmPFC/OFC; valuation and affective learning.
**Цель искусственной системы:** Target: threat/safety, affective memory, value arbitration.
**Уже есть:** Current: emotion, social/value modules.
**Разрыв:** Large gap.

### Сенсорные hierarchies
**Человеческий аналог:** Visual, auditory, somatosensory, vestibular, olfactory systems.
**Цель искусственной системы:** Target: modality-specific hierarchical encoders and body maps.
**Уже есть:** Current: semantic multimodal abstraction.
**Разрыв:** Large gap.

### Motor systems
**Человеческий аналог:** M1, premotor, SMA, basal ganglia, cerebellum, spinal/brainstem pathways.
**Цель искусственной системы:** Target: hierarchical motor control.
**Уже есть:** Current: abstract ActionGateway.
**Разрыв:** Very large gap.

### Glia/immune/vascular
**Человеческий аналог:** Astrocytes, oligodendrocytes, microglia, BBB, neurovascular coupling.
**Цель искусственной системы:** Target: support, repair, plasticity, metabolic constraints.
**Уже есть:** Current: almost entirely absent as explicit mechanisms.
**Разрыв:** Very large gap.

## 6. Что обязательно добавить в архитектурный замысел — без написания кода в этом проходе

1. **Brain Ontology Graph.** Единый граф: region, subsystem, pathway, cell class, transmitter, timescale, input/output, owner, evidence tier. Это должно стать картой, из которой строятся runtime и тесты, а не ещё одним описательным документом.

2. **Thalamocortical gateway.** Явно представить relay/gating/state-dependent gain между сенсорными, cortical and subcortical routes. Таламус нельзя оставлять скрытым в общем workspace. [S7]

3. **Basal-ganglia action loop.** Goal-directed vs habit selection, direct/indirect/hyperdirect pathways and dopamine-dependent learning. [S8–S9]

4. **Cerebellar predictor/controller.** Быстрый predictor, error correction, timing and skill learning separated from deliberative cognition. [S6]

5. **Brainstem/arousal nuclei.** LC, raphe, cholinergic systems, PAG/NTS/PBN/reticular formation — как state-control layer, а не только scalar “energy/load”. LC and ACh already show clear roles in attention/memory/cognitive state. [S13–S14]

6. **Hypothalamus/body-state graph.** Energy, temperature, hunger, thirst, pain, stress, immune load, endocrine/autonomic state. Recent 7T work shows that human allostasis/interoception is a distributed cortical-subcortical system including ACC/insula/thalamus/hypothalamus/hippocampus/ventral striatum/PAG/PBN/NTS. [S5]

7. **Limbic valuation circuits.** Amygdala, hippocampal interfaces, cingulate and vmPFC/OFC-like processes should have distinct but coupled roles.

8. **Sensory/motor hierarchies.** Separate visual, auditory, somatosensory, vestibular and olfactory pathways with body maps, while retaining semantic multimodal backends.

9. **Glial/vascular/metabolic layer.** Astrocytes, oligodendrocytes, microglia, myelination, BBB/neurovascular coupling, metabolic supply and repair. This is not decoration: activity-dependent myelin changes can affect circuit dynamics, and microglia participate in synaptic sculpting. [S15–S16]

10. **Oscillatory timing layer.** Theta/gamma/SWR-like replay coordination, phase coupling, state transitions and cross-region synchrony. Hippocampal replay is particularly important and is sensitive to sleep state. [S11–S12]

11. **Sleep/offline brain.** Wake/action/rest/NREM/REM-like states with different compute budgets, replay and consolidation. “Glymphatic clearance” should not be encoded as settled fact: the literature is actively disputed. [S12 + current Nature 2024 debate]

12. **Developmental maturation.** Critical periods, synaptic overproduction/pruning, myelination, skill progression and social development. Human adult hippocampal neurogenesis remains an evolving scientific issue and should be modeled with uncertainty rather than as a fixed fact. [S17]

## 7. Что уже сделано особенно хорошо

- **Hippocampal-like memory branch**: the project has a clear computational fast-episode/replay/slow-schema motif, which is strongly aligned with complementary-learning and replay literature. [S10–S12]

- **Predictive world model**: current architecture already treats perception, prediction, action and outcome as causal state, which is much closer to biological control than a pure chatbot loop.

- **Recurrent workspace**: the project has an explicit broadcast/recurrent loop rather than only one-pass inference. This is scientifically useful even though it is not evidence of phenomenal consciousness.

- **Neuromodulation**: dopamine, noradrenaline, acetylcholine and serotonin already exist as state variables. The next scientific task is anatomical grounding, not multiplying scalar signals.

- **Evidence discipline**: the project consistently distinguishes mechanism, integration evidence and stronger verification. This is rare and should be preserved.

- **Embodiment/resource awareness**: predictive allostasis and mobile resource controls provide a bridge toward an organism rather than an isolated reasoning process.

## 8. Что сейчас выглядит наиболее “нечеловеческим”

- The architecture is heavily software/service-shaped: many semantic engines exist, but a real nervous system has fewer explicit “services” and more recurrent shared dynamics.

- Many biological regions that implement gating, timing, arousal and action selection are implicit or absent.

- Neuromodulators are represented as global scalars instead of spatially and temporally structured projections.

- There is no explicit microcircuit layer linking cell types → local circuit motifs → large-scale networks.

- Body regulation is abstract compared with the distributed interoceptive/allostatic anatomy documented by recent human 7T mapping. [S5]

- Glial, vascular and metabolic processes are almost entirely absent as explicit causal layers.

- The project has many cognitive capabilities but needs a stronger mechanism for simultaneous competition/cooperation among subsystems under constrained energy and time.

## 9. Исследовательская карта AI × Neuro

### Transformer / sequence models
**Что показывает исследовательское направление:** Strong contextual integration; useful high-level language and multimodal reasoning.
**Что это значит для Neuro-Kurisu:** Keep as language/interface layer, not as entire brain.

### Hippocampal-inspired episodic memory
**Что показывает исследовательское направление:** Sequence memory can improve sample/memory efficiency in control.
**Что это значит для Neuro-Kurisu:** Directly relevant to current hippocampal branch.

### Predictive processing / world models
**Что показывает исследовательское направление:** Brain-like principle: prediction + error + action.
**Что это значит для Neuro-Kurisu:** Already central to world model; should be tied more tightly to body/active inference.

### Neuromodulation
**Что показывает исследовательское направление:** Dopamine, noradrenaline, acetylcholine, serotonin modulate learning/attention/exploration.
**Что это значит для Neuro-Kurisu:** Existing scalar implementation should become anatomically and causally grounded.

### Spiking / neuromorphic AI
**Что показывает исследовательское направление:** Potential efficiency and local learning, especially event-driven systems.
**Что это значит для Neuro-Kurisu:** Interesting future phone/hardware path; not necessary for current semantic runtime.

### Dendritic computation
**Что показывает исследовательское направление:** Dendrites offer alternative mechanisms for credit assignment, continual learning, energy efficiency.
**Что это значит для Neuro-Kurisu:** Potential source for local plasticity in future microcircuit layer.

### NeuroAI
**Что показывает исследовательское направление:** Bidirectional field: neuroscience informs AI, AI accelerates neuroscience; interpretability vs engineering power is a key tension.
**Что это значит для Neuro-Kurisu:** Use AI for scientific mapping and use neuroscience for constrained architecture.

### Embodied / active systems
**Что показывает исследовательское направление:** Intelligence emerges in closed perception-action loops rather than pure text generation.
**Что это значит для Neuro-Kurisu:** Critical for final target; existing body/world/action branches should be unified.

Современный NeuroAI всё чаще рассматривается как двустороннее поле: neuroscience предоставляет ограничения и идеи для AI, а AI/ML ускоряют картирование и интерпретацию мозга. При этом остаётся важная развилка: биологическая правдоподобность не равна лучшей инженерной производительности, а engineering-scale models не следует автоматически считать хорошими моделями мозга. [S18–S22]

## 10. План воспроизведения искусственного организма до максимально возможного уровня

### B-M0 — Freeze + ontology
**Содержание:** Do not code; establish canonical artificial brain ontology and evidence standards.
**Критерий:** 0 new modules; documentation only

### B-M1 — Anatomical graph
**Содержание:** Introduce one brain-wide ontology describing regions, systems, pathways, timescales, owners and evidence.
**Критерий:** No duplication of runtime ownership

### B-M2 — Thalamocortical gate
**Содержание:** Model state-dependent routing / broadcast / gain with explicit channels.
**Критерий:** Replace implicit routing where justified

### B-M3 — Basal-ganglia action loop
**Содержание:** Goal-directed vs habit policy, direct/indirect/hyperdirect abstraction, dopamine teaching signal.
**Критерий:** Agency becomes anatomically interpretable

### B-M4 — Cerebellar predictor
**Содержание:** Separate fast sensorimotor prediction/error correction from deliberative brain.
**Критерий:** Lower latency; better skill learning

### B-M5 — Brainstem + neuromodulatory nuclei
**Содержание:** Arousal, novelty, uncertainty, attention gain, sleep/wake and global mode control.
**Критерий:** Make existing scalar neuromodulators anatomically grounded

### B-M6 — Hypothalamus / allostasis / body
**Содержание:** Synthetic endocrine/autonomic state machine; hunger, temperature, energy, pain, stress, immune load.
**Критерий:** Unify body state instead of scalar load

### B-M7 — Insula/ACC/limbic affect
**Содержание:** Visceromotor and affective appraisal loops tied to body and memory.
**Критерий:** Ground emotion in state transitions

### B-M8 — Sensory and motor maps
**Содержание:** Build modality-specific hierarchies and body maps; retain high-level semantic backends.
**Критерий:** Embodiment becomes causal, not only semantic

### B-M9 — Glia + vascular + metabolic
**Содержание:** Introduce low-cost support layer: synaptic support, myelination/latency, pruning, resource supply, repair.
**Критерий:** Resource-aware plasticity

### B-M10 — Microcircuit tier
**Содержание:** Implement selective microcircuits: cortical column motif, DG/CA3/CA1, striatal loop, cerebellar microcircuit.
**Критерий:** Biological plausibility at circuit scale

### B-M11 — Oscillations / synchrony
**Содержание:** Theta/gamma/SWR-like events, phase coupling, cortical state modes.
**Критерий:** Temporal coordination becomes explicit

### B-M12 — Sleep / offline consolidation
**Содержание:** NREM/REM-like states, replay prioritization, consolidation, forgetting, dream simulation.
**Критерий:** Learning during downtime

### B-M13 — Developmental maturation
**Содержание:** Critical periods, pruning, myelination, skill stages, developmental constraints.
**Критерий:** Development becomes endogenous

### B-M14 — Brain-wide causal battery
**Содержание:** Lesion/ablation/intervention matrix for every major subsystem and pathway.
**Критерий:** No subsystem accepted by presence alone

### B-M15 — Longitudinal human-like organism
**Содержание:** Months-scale identity, social, learning, body and environmental adaptation.
**Критерий:** Measure continuity and transfer

### B-M16 — Physical Android brain
**Содержание:** Map synthetic brain state to actual sensors/actuators and mobile constraints.
**Критерий:** Real device evidence only

### B-M17 — Consciousness research tier
**Содержание:** Adversarial comparisons across GWT/recurrent/higher-order/predictive/IIT-inspired hypotheses.
**Критерий:** No consciousness claim without causal evidence

### B-M18 — Final whole-organism integration
**Содержание:** One causal event spine across perception→memory→world→self→agency→action→outcome→learning→development.
**Критерий:** Artificial organism rather than module collection

## 11. Принцип “не симулировать всё”

Полная биологическая эмуляция на уровне всех молекул, ионов и всех синапсов не является практической целью проекта на среднем телефоне. Цель должна быть **functional isomorphism at multiple scales**: воспроизводить вычислительную функцию, причинные ограничения и временную динамику там, где они важны для поведения, сохраняя более дешёвые абстракции там, где буквальная детализация не даёт прироста. Иначе система станет огромной биохимической симуляцией без полезного интеллекта.

## 12. Главная архитектурная идея

Лучший вариант — не “сделать 360 маленьких модулей для 360 зон”, а построить **единый Brain Graph + Causal Spine**. Brain Graph описывает anatomical/functional identity и допустимые pathways. Causal Spine описывает конкретное прохождение experience: `sensory/interoceptive input → attention/thalamic gating → hippocampal/cortical encoding → world model → valuation → basal-ganglia selection → cerebellar/brainstem motor preparation → action → outcome → neuromodulatory update → consolidation → self/development`. Каждый переход должен иметь evidence class and replayable trace.

## 13. Приоритеты для среднего телефона

- High-resolution cell/molecular simulation — **не сейчас**; хранить как ontology/metadata.

- Thalamus, basal ganglia, cerebellum, brainstem and synthetic body-state graph — **высокий приоритет**, потому что они закрывают структурные разрывы без огромного compute overhead.

- Oscillatory events should be event-driven, not continuous floating-point simulation.

- Sleep/replay should run as scheduled low-cost offline jobs.

- 360 cortical areas should initially be a semantic/graph representation rather than 360 independent recurrent networks.

- Use one shared causal event fabric instead of dozens of polling loops.

## 14. Новые гипотезы, которые имеет смысл исследовать

**A. Anatomical compression:** a small set of explicit high-value circuits (thalamic gate, basal-ganglia selector, cerebellar predictor, hippocampal replay, brainstem neuromodulators) may produce a disproportionate increase in human-like behavioural dynamics compared with adding more generic LLM capacity.

**B. State geometry over module count:** human-like behaviour may depend more on the geometry and temporal coupling of shared latent state than on the number of cognitive modules. The project should therefore measure state transitions and cross-system phase relationships, not only feature presence.

**C. Biological uncertainty as an architectural feature:** disputed neuroscience (e.g., adult human neurogenesis or glymphatic interpretations) should remain alternative hypotheses in the artificial brain rather than hard-coded facts. This turns scientific uncertainty into a learning mechanism. [S17]

**D. Brain-energy economy as intelligence prior:** an artificial brain should treat compute/energy/opportunity cost as a first-class internal variable. This is especially important on a phone and aligns with biological constraints without requiring biological hardware.

## 15. Итоговая оценка ветки мозга

| Aspect | Current judgment |
|---|---:|
| Computational cognitive coverage | High |
| Hippocampal/replay branch | High |
| Predictive/world-model branch | High |
| Recurrent/global integration | Medium-high |
| Neuromodulatory abstraction | Medium |
| Explicit thalamic/basal-ganglia/cerebellar architecture | Low |
| Brainstem/hypothalamic/vascular/glial realism | Low |
| Microcircuit realism | Low |
| Whole-brain anatomical correspondence | Low-medium |
| Evidence discipline | High |
| Phenomenal consciousness evidence | None established |

## 16. Источники

**S1. Human Connectome Project / HCP-MMP1.0.** Multimodal cortical parcellation: 180 areas per hemisphere; multimodal borders and individual subject mapping. https://pmc.ncbi.nlm.nih.gov/articles/PMC5198757/

**S2. NIH BRAIN Initiative — BICAN.** Whole-brain cell atlas goal across molecular, anatomical and functional dimensions; explicit recognition that a complete reference atlas is still a project goal. https://www.braininitiative.nih.gov/research/tools-and-technologies-brain-cells-and-circuits/brain-initiative-cell-atlas-network

**S3. Allen Brain Atlas Cell Types.** Human/mouse single-cell feature data and cell-type exploration. https://celltypes.brain-map.org/data

**S4. NIH BRAIN Initiative — circuit diagrams.** Maps at multiple scales, from synapses to whole brain. https://www.braininitiative.nih.gov/vision/priority-areas

**S5. Zhang et al., Nature Neuroscience 2025.** Human allostatic–interoceptive system, 7T mapping, >96% correspondence with animal tract-tracing connections examined. https://www.nature.com/articles/s41593-025-02087-x

**S6. Nguyen & Person, Nature Reviews Neuroscience 2025.** Cerebellar predictive motor control, feedforward computations and error-driven learning. https://www.nature.com/articles/s41583-025-00936-z

**S7. Shine et al., Nature Reviews Neuroscience 2023.** Thalamus as brain-wide integrative influence on adaptive behaviour. https://www.nature.com/articles/s41583-023-00701-0

**S8. Yin & Knowlton, Nature Reviews Neuroscience.** Basal ganglia in action selection, instrumental behaviour and habits. https://www.nature.com/articles/nrn1919

**S9. Gershman & Uchida, Nature Reviews Neuroscience.** Dopamine as reward prediction error plus uncertainty/exploration-related computation. https://www.nature.com/articles/s41583-019-0220-7

**S10. Eichenbaum / hippocampal-neocortical memory reviews.** Bidirectional hippocampal–cortical systems and episodic memory. https://www.nature.com/articles/35036213

**S11. Joo & Frank, Nature Reviews Neuroscience.** Sharp-wave ripples, replay and memory consolidation/retrieval. https://www.nature.com/articles/s41583-018-0077-1

**S12. Giri et al., Nature 2024.** Sleep loss diminishes hippocampal reactivation and replay. https://www.nature.com/articles/s41586-024-07538-2

**S13. Basal forebrain cholinergic signalling, Nature Reviews Neuroscience 2023.** ACh networks support cognition with structured cortical innervation. https://www.nature.com/articles/s41583-023-00677-x

**S14. Locus coeruleus / noradrenaline review.** Noradrenergic modulation of attention, memory retrieval and network reorganization. https://www.nature.com/articles/nrn2573

**S15. Microglia, Nature Neuroscience 2025.** Microglial pruning and circuit sculpting. https://www.nature.com/articles/s41593-024-01818-w

**S16. Oligodendroglial interactions, Nature Reviews Neuroscience 2023.** Activity-dependent myelin plasticity and influence on learning/memory. https://www.nature.com/articles/s41583-023-00744-3

**S17. Human hippocampal neurogenesis, Nature 2026.** Adult human hippocampal neurogenesis remains a difficult and actively updated question; avoid treating it as settled fact. https://www.nature.com/articles/s41586-026-10169-4

**S18. The new NeuroAI, Nature Machine Intelligence 2024.** Modern NeuroAI reconnects neuroscience and AI; current AI has diverged from biological inspiration. https://doi.org/10.1038/s42256-024-00826-6

**S19. Emergence of NeuroAI, Nature Reviews Neuroscience 2025.** NeuroAI as a two-way field: AI for neuroscience and neuroscience for AI; interpretability is a central challenge. https://www.nature.com/articles/s41583-025-00954-x

**S20. Brain-inspired computing systematic review 2024.** Broad landscape of brain-inspired computing hardware/software. https://link.springer.com/article/10.1140/epjb/s10051-024-00703-6

**S21. Dendritic neuro-inspired ML review 2024.** Dendritic mechanisms as potential source for credit assignment, continual learning and energy efficiency. https://www.sciencedirect.com/science/article/pii/S0959438824000151

**S22. Human brain computing and brain-inspired intelligence 2024.** Relationship among structure, activity dynamics and intelligence is complex and multi-level. https://academic.oup.com/nsr/article/11/5/nwae144/7656427
