# P2851 Research & Design

## Replay / continual learning

Experience replay is a core mechanism for mitigating forgetting in sequential learning. Brain-inspired replay work also motivates replay of internal/latent representations instead of storing complete raw observations. Sleep-like replay studies combine spontaneous reactivation with local plasticity and report reduced catastrophic forgetting.

Sources:
- van de Ven, Siegelmann & Tolias, *Brain-inspired replay for continual learning with artificial neural networks* (Nature Communications, 2020).
- Tadros et al., *Sleep-like unsupervised replay reduces catastrophic forgetting in artificial neural networks* (Nature Communications, 2022).
- Wang, Chandra & Zhang, *Experience Replay Addresses Loss of Plasticity in Continual Learning* (arXiv, 2025).

## Design consequences

P2851 therefore adds a task-sensitive replay probe instead of counting weight updates as success. The next benchmark should use independent task families, interleaved and sequential schedules, holdout evaluation, forward transfer, backward interference, parameter drift and replay ablations.

## Sleep/wake direction

Neuroscience literature describes replay during both sleep and awake pauses, with sleep supporting systems consolidation and transformations of memory representations. A future implementation should therefore separate at least: awake online replay, low-budget offline consolidation, and deeper sleep-like replay. The scheduler must remain device-aware for the Android/Termux target.

## Developmental plasticity

Plasticity should not be a fixed global multiplier. P2851 uses a bounded evidence-driven scale so stable verified outcomes can slowly increase learning capacity while uncertainty/novelty and stability constraints prevent uncontrolled growth. Future work should split plasticity by timescale, context and circuit class.

## Boundary

The implementation is a computational neural model. None of these mechanisms by themselves establish consciousness, sentience, or equivalence to a human brain.
