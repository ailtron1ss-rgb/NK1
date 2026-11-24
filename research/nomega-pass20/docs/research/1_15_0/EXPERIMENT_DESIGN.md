# NΩ 1.15.0 experimental program

## Objective
Raise actual verified capability while preserving old abilities, reducing search/compute cost, and making self-improvement evidence-driven.

## Track separation
1. `PURE_NEURAL`: no TaskSpec condition and no deterministic repair.
2. `TASKSPEC_ASSISTED`: semantic parser and typed IR may condition generation.
3. `TASKSPEC_ASSISTED_EXECUTION_GUIDED`: typed IR plus bounded execution feedback/repair.
4. `RETRIEVAL_PLUS_REPAIR`: retrieval and local repair, reported separately.
5. `DETERMINISTIC_BASELINE`: explicit reference implementation only.

## Promotion gates
Every new candidate needs matched budget, multi-seed evidence, holdout gain, verified non-regression, OOD and adversarial non-regression, restart continuity, negative-transfer freedom, latency/memory bounds, and a reproducible checkpoint lineage.

## Next high-value experiments
- V9/V5 with full-budget matched training across 6, 10, then 20 families.
- V9/V5 + execution-guided local repair with the same execution budget.
- Program-sketch beam/reranking ablation against pure V9.
- paraphrase and composition OOD sets that are not in training cues.
- multi-turn task acquisition where the model chooses whether to execute or abstain.
- static int8/fixed-shape inference measurements on real Termux hardware.
- sparse expert routing only after dense baseline measurements establish an actual latency/energy benefit.
- continual-learning runs with explicit negative-transfer measurement and restart checks.
