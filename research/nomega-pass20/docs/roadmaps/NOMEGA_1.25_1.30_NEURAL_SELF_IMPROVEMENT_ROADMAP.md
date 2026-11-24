# NOMEGA 1.25–1.30 Neural Self-Improvement Roadmap — Updated 2026-09-21

## 1.25 — Neural Causality & Credit Assignment — IMPLEMENTED / N1 MEASURED

Execution-grounded attribution, counterfactual credit, parameter ablation and a causal evidence ledger are implemented. N1 was reproduced on independent seeds; N2 was not promoted because the main NOMEGA held-out verified gain stayed at zero.

## 1.26 — Online Continual Learning & Neural Plasticity — IMPLEMENTED / N1 MAINTAINED

Implemented immutable partitions, stream shift monitoring, adaptive replay, interference diagnostics, plasticity diagnostics, functional anchor regularization, transactional commit/rollback and true checkpoint reload equivalence. A real four-phase PyTorch benchmark now measures the stability/plasticity trade-off across five controlled strategies.

The benchmark is auxiliary evidence about continual adaptation; it does not by itself promote the main neurality ladder.

## 1.27 — Neural Self-Optimization — IMPLEMENTED / N4 NOT PROMOTED

`NeuralSelfOptimizationControllerV2` now performs state-conditioned advantage learning from measured incumbent-relative utility. The production benchmark measures the incumbent first, lets the neural controller choose before candidate execution, enforces equal-budget external gating, supports persistent transaction rollback, restart-equivalence, and a `defer/no-change` action when evidence is insufficient. A post-decision oracle sweep is explicitly excluded from production budget and used only for selection-regret evidence and future controller training.

Three independent seeds produced 10 defers, 1 commit, and 1 rollback across four phases. The committed case improved measured utility by +0.07369 under equal budget, but mean utility of executed candidate runs was still below incumbent, so N4 remains unpromoted.

## 1.28 — Autonomous Repair Learning

Train repair policies directly from verified failure → counterexample → patch → verification trajectories. Include explicit STOP, BACKTRACK, MODIFY-ONE-OP and REQUEST-MORE-EVIDENCE actions. Independent TinyVM/HVM verification remains mandatory.

## 1.29 — Open-Ended Controlled Capability Evolution

Maintain branching lineages, archive diversity, environment co-evolution, metaproductivity and sandboxed experiments. Candidate branches become canonical only after independent evidence, holdout/OOD checks and rollback safety.

## 1.30 — Integrated Self-Development

Repeated closed loop: bottleneck discovery → targeted environment → neural learning/repair → causal ablation → continual adaptation → holdout/OOD evaluation → promotion/rollback → lineage archive → next bottleneck.

## Neurality ladder

- N0: trainable neural component exists and executes.
- N1: neural intervention changes decisions relative to a frozen neural state.
- N2: training improves held-out verified behavior on the main NOMEGA task stack.
- N3: online adaptation improves unseen main-stack tasks without direct leakage while preserving previous capabilities.
- N4: neural control improves the efficiency of learning/search itself under equal-budget tests.
- N5: repeated autonomous cycles produce reproducible verified gains and safe rollback under regression.

"100%" means every gate above is implemented, reproducible and evidence-backed. It is not a claim of universal intelligence, consciousness or an absolute capability ceiling.
