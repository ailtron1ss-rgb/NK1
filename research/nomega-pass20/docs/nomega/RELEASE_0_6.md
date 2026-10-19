# NΩ-Core 0.6.0 — Adaptive Learning Runtime

## Delivered

- deterministic multi-family curriculum with disjoint train/holdout IDs
- bounded replay buffer for continual learning
- self-play/conflict sampling: prioritizes tasks where experts disagree
- joint router learning harness initialized from the last stable router checkpoint
- anti-forgetting router distillation primitive
- repeated verified procedure → memory/program consolidation
- capability matrix across train/holdout and capability families
- promotion comparison utility with family-level non-regression checks
- research suite upgraded to 0.6.0 and includes capability statistics
- reproducible runtime evaluation artifact in `runtime/nomega_06_eval.json`

## Verified in this build

- NΩ tests: 24/24 pass
- Python compileall: pass
- research suite main verified rate: 5/6 = 0.8333
- research suite holdout: 0/4 = 0.0 (honest unknown/generalization baseline)
- self-play conflict mean disagreement: ~0.842 on sampled curriculum
- joint-learning smoke: stable baseline 0.125 holdout verification rate; candidate 0.125 (no measured gain)

## Interpretation

The 0.6.0 work is infrastructure for learning, not a claim of general intelligence. The strongest result is that the system can now generate a controlled learning curriculum, identify disagreement regions, replay prior routing decisions, and reject promotions that do not improve held-out capability.

The next research objective is to improve the learning objective itself: use expert counterfactual utilities plus program-level verification and anti-forgetting constraints to optimize router decisions on disagreement-rich tasks, while separately improving NeuralInvent generalization.
