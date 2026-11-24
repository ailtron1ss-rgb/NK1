# Карта искусственного мозга — статус внедрения BIG PASS 207

## Режим прохода

В этом проходе исходная исследовательская карта не перезаписывается. Она становится **архитектурным источником истины**, а поверх неё появляется implementation layer.

### Реально внедрено

**B-M1 — Anatomical/Causal Ontology**

Добавлен `ArtificialBrainAtlas` с 18 системами и 18 связями. Для каждой системы фиксируются:

- биологическая роль;
- вычислительная роль;
- текущие владельцы в проекте;
- отсутствующие возможности;
- приоритет;
- рабочий диапазон времен.

Это должно предотвратить повторное разрастание проекта через новые независимые P/Pxx-модули без владельца.

**B-M2 — Thalamocortical Gain Gate, первый рабочий слой**

Добавлен `ThalamocorticalGate`. Он реализует вычислительный analogue state-dependent routing/gain перед центральной интеграцией P61/P64.

Каналы:

- observation;
- prediction;
- memory;
- social;
- action;
- interoception;
- research.

Gate учитывает energy, thermal pressure, cognitive capacity, uncertainty, prediction error, grounding, causality, metacognition, memory health, goal/social pressure и identity governance.

### Результаты BIG PASS 207

- atlas regions: **18**;
- atlas edges: **18**;
- implementation coverage proxy: **0.50**;
- critical gaps: **6**;
- low-resource broadcast: **0.2933**;
- healthy/high-demand broadcast: **0.7988**;
- low-resource explore gain: **0.6831**;
- healthy/high-demand explore gain: **0.8751**;
- gate restore: **PASS**;
- core integration: **PASS**;
- typecheck: **PASS**;
- brain audit: **PASS**.

### Что означает coverage 0.50

Это не процент «мозга человечества, воспроизведённого в коде». Это консервативный implementation proxy: система имеет хотя бы один computational owner, но для многих биологических систем отсутствуют специфические подструктуры.

### Главные оставшиеся критические ветки

1. explicit thalamic nuclei and reciprocal loops;
2. basal-ganglia circuit with explicit dopamine-gated learning;
3. hypothalamic/autonomic body-state pathways;
4. neuromodulatory source-to-target projection and temporal pulse semantics;
5. distributed interoceptive/allostatic anatomy;
6. cortical multi-area/laminar organization.

### Следующие большие проходы

**B-M3 — Basal Ganglia / Action Selection**

Striatum → GPe/GPi → STN → thalamic output, with a computationally explicit selection/learning loop and ablation tests.

**B-M4 — Cerebellar Predictive Controller**

Fast forward model, timing/error correction and motor-prediction branch, integrated with embodied action without replacing existing world models.

**B-M5 — Hypothalamus / Brainstem / Allostatic Core**

Homeostatic variables, arousal, wake/sleep and resource-directed routing; connect to phone energy/thermal state.

**B-M6 — Neuromodulatory Projection Graph**

Dopamine, norepinephrine, acetylcholine and serotonin become source→target→pulse→plasticity channels rather than scalar state variables.

**B-M7 — Cortical Area Graph**

Move from one central recurrent cortex abstraction toward a canonical multi-area graph, beginning with high-value association/attention/executive/visual/auditory/language regions.

**B-M8 — Glia / Vascular / Metabolic Layer**

Introduce circuit maintenance cost, myelination/latency, metabolic reserve and long-horizon repair without pretending to simulate every molecular process.

**B-M9 — Sleep / Replay Coupling**

Explicit NREM/REM-like modes, hippocampal replay, consolidation and offline plasticity under bounded phone compute.

**B-M10 — Whole-Brain Causal Battery**

Run perturbations/lesions across the atlas and compare whether the resulting computational phenotype is expected, absent, or contradictory.

## Scientific basis

The human cortex does not have one single universally accepted “complete map”. The HCP-MMP1.0 multimodal parcellation established 360 cortical areas as one important reference, while BICCN/BICAN aim to integrate molecular, anatomical, physiological and cell-type information across scales.¹²

The thalamus is increasingly treated as a brain-wide information-processing and adaptive-control hub, not merely a passive relay.³

Cerebellar circuits are strongly relevant to predictive motor control, timing and error correction.⁴

Neuron–astrocyte metabolic coupling is now an explicit subject of brain-energy research, supporting the decision to treat glia/metabolism as first-class architecture rather than decoration.⁵

## Sources

1. Glasser et al., *A multi-modal parcellation of human cerebral cortex*, Nature, 2016. https://www.nature.com/articles/nature18933
2. NIH BRAIN Initiative, Cell Atlas Network / Cell Census Network. https://www.braininitiative.nih.gov/research/tools-and-technologies-brain-cells-and-circuits/brain-initiative-cell-atlas-network
3. Shine et al., *The impact of the human thalamus on brain-wide information processing*, Nature Reviews Neuroscience, 2023. https://www.nature.com/articles/s41583-023-00701-0
4. Nguyen & Person, *Cerebellar circuit computations for predictive motor control*, Nature Reviews Neuroscience, 2025. https://www.nature.com/articles/s41583-025-00936-z
5. Bolaños & Magistretti, *The neuron–astrocyte metabolic unit as a cornerstone of brain energy metabolism*, Nature Metabolism, 2025. https://www.nature.com/articles/s42255-025-01404-9
6. *The new NeuroAI*, Nature Machine Intelligence, 2024. https://www.nature.com/articles/s42256-024-00826-6
