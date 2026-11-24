# Интернет-исследование — 16.09.2026

## Что наиболее полезно для Neuro-Kurisu

### 1. Nested Learning / Hope
Google Research описывает модель как совокупность взаимосвязанных nested optimization problems с разными частотами обновления; отдельно вводится continuum memory, где разные компоненты обновляются с разной скоростью. Это непосредственно поддерживает выбранный нами fast/medium/slow memory path.

Источник: https://research.google/blog/introducing-nested-learning-a-new-ml-paradigm-for-continual-learning/

### 2. Titans
Titans рассматривает test-time neural memory как отдельный долговременный механизм, который дополняет кратковременный контекст. В опубликованных экспериментах авторы показывают работу с контекстами свыше 2M токенов; для нашего проекта важна не цифра сама по себе, а архитектурный принцип отдельной persistent neural memory.

Источник: https://arxiv.org/abs/2501.00663

### 3. MIRAS
MIRAS исследует пространство дизайна test-time memorization: memory architecture, attentional bias, retention и online optimization. Это особенно полезно для нашей схемы surprise + salience + retention.

Источник: https://arxiv.org/abs/2504.13173

### 4. V-JEPA 2
Meta показывает action-conditioned latent world prediction и использование predicted consequences для planning/control. Также выпущены CausalVQA, MVPBench и IntPhys 2, направленные на counterfactuals, anticipation и физическую причинность.

Источник: https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks/

### 5. Distributed population representations
Исследование Meta 2026 по интерпретируемости video world models сообщает, что motion direction может быть кодирована как высокоразмерный population code, а не как один компактный scalar state. Это мотивировало экспериментальный population-code expert B401–B420.

Источник: https://ai.meta.com/research/publications/interpreting-physics-in-video-world-models/

### 6. Mamba / SSM
Structured state-space family остаётся полезным направлением для компактной последовательной памяти и recurrent compute на слабом устройстве.

Источник: https://arxiv.org/abs/2405.21060

### 7. DreamerV3
World-model family с imagined future trajectories полезна как концептуальная основа для многошагового predictive control. Мы пока используем только lightweight rollout идеи, а не full Dreamer training loop.

Источник: https://arxiv.org/abs/2301.04104

## Что имеет смысл экспериментировать дальше

1. Retrieval-conditioned neural state.
2. Hierarchical JEPA-like predictors: short / medium / long horizon.
3. Continual memory with separate update frequencies.
4. Population-code neural representations.
5. Surprise-driven memory consolidation.
6. Counterfactual action evaluation.
7. Learned gating между memory/prediction/self/goal experts.
8. Self-model prediction error как отдельный learning signal.
9. Goal generation from unresolved prediction/value conflicts.
10. Offline replay только для verified episodes.
11. Lesion-driven model selection.
12. Adaptive compute budget по uncertainty/novelty/energy.

## Гипотеза о совмещении методов

Наиболее перспективна не ставка на один алгоритм, а связка:

`multi-timescale memory → retrieval → distributed latent state → world prediction → counterfactual rollout → goal/value competition → action → verified outcome → selective plasticity`

Это и есть основной принцип B401–B420.
