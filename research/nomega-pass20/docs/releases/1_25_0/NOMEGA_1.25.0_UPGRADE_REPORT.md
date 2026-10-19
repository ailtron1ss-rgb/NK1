# NOMEGA 1.25.0-dev — Neural Causality & Credit Assignment

## Implemented

1. `neural_causal_credit_v1.py` — leave-one-out, replacement and parameter-ablation attribution.
2. `neural_causal_credit_trainer_v1.py` — execution-derived bounded gradient weighting.
3. `neural_causality_benchmark_v2.py` — causal intervention benchmark with strict N0–N5 gates.
4. `neural_self_optimization_controller_v1.py` — neural surrogate for learning/search configuration selection with equal-budget governance.
5. Learning lab integration — frozen neural state, execution counterfactual credit, causal update, intervention benchmark and causal self-model recording.
6. N2 gate strengthened to require positive verified holdout gain.

## Fresh multi-seed evidence

Experiment: `sum3 + xor3`, hidden=24, supervised epochs=2, preference epochs=1, seeds 12511/12512/12513.

- independent runs: 3
- N1: 3/3
- N2: 0/3
- mean decision change rate: 0.145833
- mean parameter-ablation max effect: 0.068363
- mean dense causal gain: 0.022331
- mean verified holdout gain: 0.0
- promotions: 0/3

Interpretation: the neural intervention is now measurably causal at N1, but the system has not demonstrated neural generalization on held-out verified tasks, so it remains research-only and unpromoted.

## Verification

Focused new/critical matrix: 17 tests passed.
The full historical suite remains separately reported where timeouts prevent a complete fresh run; no timeout is reclassified as a pass.

## Next direct stage

### 1.26 — Neural Online Continual Learning

- plasticity and forgetting curves,
- uncertainty-triggered replay,
- interference-aware replay selection,
- immutable holdout/OOD/regression partitions,
- checkpoint rollback,
- restart/reload equivalence,
- multi-seed adaptation benchmark.

### 1.27 — Neural Self-Optimization

The new meta-controller becomes an experimental active controller over curriculum, replay mix, search budget, batch size and routing. Promotion remains equal-budget and externally evaluated.
