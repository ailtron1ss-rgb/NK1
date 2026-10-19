# NOMEGA 1.29 Research Notes — Open-Ended Controlled Capability Evolution

## Motivation
The current stack can learn repair preferences, reason over causal credit, control continual replay, and choose equal-budget learning configurations. The remaining limitation is a mostly fixed repair-operator vocabulary. NΩ 1.29 introduces a bounded mechanism for evolving the operator *composition* itself.

## Research Anchors
- AlphaEvolve demonstrates combining model-generated program candidates, automated evaluators, and an evolutionary population/archive for algorithm discovery. The NΩ design follows the same separation between proposal and objective verification but keeps the domain-specific verifier external. 
- Recent work on self-evolving coding agents identifies executable feedback, repository-level context, and reusable trajectories as useful evolution signals while warning about feedback reliability, benchmark overfitting, cost, and generalization. NΩ therefore keeps newly discovered operators research-only until external held-out evidence supports promotion.
- Recent work on growing and elastic neural networks in online continual learning reports that adaptive growth can preserve plasticity, while elastic growth+pruning can keep model size compact. NΩ exposes growth/pruning through a transactional external gate rather than allowing the substrate to self-approve structural changes.

## Experiments
Three seeds were evaluated on two gradual transitions: `sum3 -> xor3` and `mul2 -> sub_offset`, with five hidden drift phases per transition. Candidate selection for a phase only saw that phase's train evidence; current/future holdouts were kept outside candidate selection.

## Observed Result
Across six transition runs:
- static mean = `0.5733`
- evolved mean = `0.5800`
- mean final gain = `+0.0333`
- one transition/seed showed a positive final improvement; others tied the baseline.

This is evidence of useful search behavior on the controlled benchmark, not evidence of broad general capability improvement.

## Structural Plasticity
The conservative benchmark rejected all nine attempted structural mutations through the external evaluator. A separate component test produced a successful grow transaction and verified exact fresh-model state equivalence after the change. Both outcomes are preserved: safe rollback is the normal research path when utility evidence is insufficient.

## Next Experiments
1. Expand drift geometry beyond a two-oracle linear mixture.
2. Use held-out semantic-equivalence checks to prevent structural novelty from being mistaken for capability novelty.
3. Couple operator discovery to the main neural execution-learning stack and measure verified capability gain, not only repair/search utility.
4. Introduce cross-family transfer tests where evolved operators are trained on source families and evaluated on unseen target families.
