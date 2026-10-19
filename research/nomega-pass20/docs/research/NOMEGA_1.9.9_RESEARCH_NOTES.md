# NΩ 1.9.9 — Research Notes

## Current research inputs

### 1. Transfer-Selective Replay (2026)
A 2026 continual-learning work argues that forward transfer should be treated as an explicit selection objective and proposes selecting replay based on task signatures and compatibility rather than replaying past examples indiscriminately.

Source: https://arxiv.org/abs/2607.15587

**NΩ response:** `transfer_selective_replay_v1.py` adds a semantic task signature, compatibility score, empirical transfer estimate, negative-transfer penalty and anchor protection.

**Status:** component implemented. Downstream neural learning gain is **not yet proven**.

### 2. Replay can increase forgetting (2026)
A 2026 lifelong-learning result shows that adding more replay is not monotonically beneficial and that replay choice and task relationships can determine whether forgetting is reduced or increased.

Source: https://proceedings.mlr.press/v330/mahdaviyeh26a.html

**NΩ response:** replay is now evidence-gated; negative transfer is tracked per source/target and the new unlearning layer can quarantine repeatedly harmful memory records.

### 3. Replay and gradient alignment for continual pre-training (2026)
A 2026 study reports that replay and gradient-alignment mechanisms can stabilize continual learning under distribution shift.

Source: https://proceedings.mlr.press/v330/abbes26a.html

**NΩ response:** gradient-alignment is intentionally not added blindly. It is a future experiment because NΩ's current program learner uses execution-verified program rows, and an implementation should operate on the actual gradient/update path rather than as a decorative score.

### 4. Self-evolving coding agents survey (2026)
The current literature emphasizes executable feedback, repository context and accumulated coding trajectories, while also warning about benchmark overfitting, maintainability, feedback reliability, cost and generalization.

Source: https://arxiv.org/abs/2608.03392

**NΩ response:** this reinforces the existing governance lifecycle and motivates the causal self-model instead of treating score improvements as sufficient evidence.

### 5. Evolutionary coding mechanism analysis (EvoTrace, 2026)
Recent work argues that evolutionary coding gains should be decomposed into mechanism types such as retuning, substitution, recombination and reintroduction rather than reporting only final evaluator scores.

Source: https://arxiv.org/abs/2605.20086

**NΩ response:** `EvolutionDiagnosticsV1` is now part of the canonical evidence path.

## Original NΩ hypotheses introduced in 1.9.9

### Model-time replay
Replay should be triggered by measured model evolution (parameter displacement and loss shock), not by fixed epoch/step intervals. This is an NΩ hypothesis, not a literature-proven claim.

### Selective memory unlearning
A memory item that repeatedly causes negative transfer to a target family should enter quarantine rather than continue to influence replay. The 1.9.9 implementation uses repeated empirical evidence and a minimum-attempt gate.

### Causal self-model
The developmental controller should retain a causal ledger of:
`bottleneck -> intervention -> baseline -> outcome -> delta -> confidence`
so that future planning can prefer interventions that repeatedly worked under comparable conditions.

## Experimental status

- Semantic selective replay component gain on the fixed 1.9.9 benchmark: **0.0** preferred-item gain.
- Negative-transfer guard on known harmful source: **PASS**.
- Selective unlearning: **3 repeated negative observations -> quarantine**.
- Model-time controller: **2 replay triggers / 1 replay epoch in the controlled continual benchmark**.
- Controlled neural continual benchmark: downstream coverage remained **0.0 -> 0.0**, so no causal neural gain is claimed.

## Next research experiments

1. Gradient-alignment replay on the actual program-decoder gradient path.
2. Task-signature transfer with uncertainty-calibrated compatibility rather than a fixed heuristic.
3. Multi-seed static vs selective vs model-time replay under a larger but equal optimizer budget.
4. Memory unlearning precision/recall: harmful memories removed vs beneficial memories accidentally quarantined.
5. Causal intervention ranking over a long evidence history rather than one or two observations.
6. Real Android/Termux measurements and mobile-specific replay budgets.
