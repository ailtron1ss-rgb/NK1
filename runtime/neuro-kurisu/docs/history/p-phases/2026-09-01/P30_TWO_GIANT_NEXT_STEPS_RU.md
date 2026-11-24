# Два гигантских шага после P30

## GIANT STEP 1 — P31 Continual Intelligence Validation

Цель: доказать, что развитие не разрушает старые способности.

### Пакет
- Task-A/B/C/D sequential benchmark.
- Held-out multi-seed evaluation.
- Catastrophic forgetting curves.
- Transfer matrix.
- Signed/persisted checkpoints.
- Delta rollback.
- Unified provenance graph.
- Automatic quarantine of suspicious updates.
- Statistical confidence intervals.
- Baseline family: fixed heuristic, P23-only, P26-only, P26+P29, P26+P29+P30.

### Gate
P31 считается успешным только при одновременном:
- улучшении held-out performance;
- ограниченном forgetting;
- reproducibility across seeds;
- меньшей стоимости при одинаковом качестве;
- отсутствии необъяснимых identity/value regressions.

## GIANT STEP 2 — P32 Autonomous Research + Semantic Perception

### Пакет
- semantic local vision;
- semantic local audio;
- temporal multimodal encoder;
- multi-step latent world model;
- isolated counterfactual simulator;
- experiment execution sandbox;
- hypothesis generation;
- control/treatment scheduling;
- automatic analysis;
- evidence promotion;
- long-term identity/provenance revision.

### Уникальная идея
Ввести **Experiment Portfolio**: организм не выбирает только одну гипотезу. Он держит небольшой портфель экспериментов с разной стоимостью, риском и expected information gain, периодически перераспределяя вычислительный бюджет между ними. Это превращает curiosity в управляемую исследовательскую экономику.

## После P32
Только после этих двух этапов имеет смысл массово расширять semantic perception и внешние tool capabilities.
