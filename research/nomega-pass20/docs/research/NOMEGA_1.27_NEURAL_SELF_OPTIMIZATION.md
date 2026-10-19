# NΩ 1.27 — Neural Self-Optimization Research Notes

## Scope

This release tests whether a neural meta-controller can select learning/update configurations from the measured state of the 1.26 continual-learning stack.

## Method

The controller receives measured incumbent-relative state and candidate action features. It predicts **advantage = candidate utility − incumbent utility** with a small neural ensemble. Candidate promotion is never decided by the neural predictor itself. The production loop measures the incumbent first, selects before candidate execution, evaluates the selected candidate at equal budget, checks restart equivalence, and uses an external promotion gate.

The controller can also emit `defer/no-change` when predicted advantage is non-positive or uncertainty is above the configured safety ceiling.

Oracle candidate sweeps happen only after the production decision and are excluded from production budget; they quantify selection regret and provide training evidence for later phases.

## Research connection

Recent work on adaptive/growing and elastic neural networks suggests that structural plasticity can help preserve online learning capacity, while work on gradually changing environments shows that abrupt task shifts can confound plasticity measurements. NΩ therefore keeps structural growth/pruning as a separately measured 1.28 branch rather than mixing it into the 1.27 optimizer-control result.

## Evidence

Across seeds 41, 43, 47 on `sum3 → xor3 → mul2 → sub_offset`: 3/3 runs maintained equal production budgets and restart equivalence; 10 decisions deferred, 1 committed, and 1 rolled back. The committed run produced +0.073691 utility versus incumbent at equal budget. Mean utility difference over executed candidate runs remained negative, so the N4 gate was not promoted.

## Interpretation

The result is a real safety/measurement step rather than a claim of solved self-optimization. The controller demonstrates state-conditioned neural proposal control and safe abstention, but the current small benchmark does not yet prove a general learning-efficiency advantage.
