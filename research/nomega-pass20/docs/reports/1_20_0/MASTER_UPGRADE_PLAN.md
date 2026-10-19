# NΩ Master Upgrade Plan — Hierarchical Pass System

## Mission

Develop NΩ toward a highly autonomous, self-improving coding/reasoning system with verified
execution, persistent skills, active research, and bounded self-modification.

## Level 0 — Core law

Every improvement must terminate in a measurable change in capability, efficiency, reliability,
transfer or self-improvement productivity.

## Level 1 — Mega passes

### Pass 0 — Ground truth
0.1 freeze baseline; 0.2 version consistency; 0.3 dependency graph; 0.4 config usage; 0.5
execution path inventory; 0.6 benchmark inventory; 0.7 runtime health; 0.8 evidence ledger.

### Pass 1 — Canonical architecture
1.1 canonical interfaces; 1.2 eliminate duplicate versions where equivalent; 1.3 break import
cycles; 1.4 unify state/result contracts; 1.5 isolate research-only modules; 1.6 define promotion
boundaries.

### Pass 2 — Executable spine
2.1 prompt grounding; 2.2 TaskSpec; 2.3 program sketch; 2.4 candidate portfolio; 2.5 cheap
execution; 2.6 independent execution; 2.7 exact verifier; 2.8 evidence contract; 2.9 memory/skill
persistence; 2.10 restart proof.

### Pass 3 — Neural synthesis
3.1 typed encoder; 3.2 structured decoder; 3.3 partial-program state; 3.4 value model; 3.5
uncertainty; 3.6 candidate diversity; 3.7 neural/retrieval fusion; 3.8 execution-feedback learning.

### Pass 4 — Search scaling
4.1 beam; 4.2 UCB/PUCT-style selection; 4.3 verifier-guided tree search; 4.4 counterexample state;
4.5 adaptive budget; 4.6 failure clustering; 4.7 restart diversification; 4.8 best-of-N evidence.

### Pass 5 — Repair
5.1 operator taxonomy; 5.2 semantic repair; 5.3 syntax repair; 5.4 type/dataflow repair; 5.5
counterexample-conditioned repair; 5.6 repair policy learning; 5.7 transfer of repair operators.

### Pass 6 — Learning loop
6.1 execution trajectories; 6.2 replay; 6.3 prioritized counterexamples; 6.4 curriculum frontier;
6.5 continual learning; 6.6 anti-forgetting; 6.7 value calibration; 6.8 transfer measurements.

### Pass 7 — Memory
7.1 episodic; 7.2 semantic; 7.3 procedural; 7.4 strategic; 7.5 provenance; 7.6 confidence;
7.7 consolidation; 7.8 selective unlearning; 7.9 negative-transfer detection.

### Pass 8 — World model
8.1 state model; 8.2 action consequence model; 8.3 uncertainty; 8.4 planning; 8.5 recovery;
8.6 experiment-selection model; 8.7 long-horizon evaluation.

### Pass 9 — Self-model
9.1 capability map; 9.2 failure signatures; 9.3 causal hypotheses; 9.4 intervention results;
9.5 bottleneck ranking; 9.6 calibration; 9.7 metaproductivity.

### Pass 10 — Autonomous research
10.1 hypothesis generation; 10.2 experiment proposal; 10.3 cost estimation; 10.4 factorial design;
10.5 paired seeds; 10.6 statistical comparison; 10.7 evidence archive; 10.8 update curriculum.

### Pass 11 — Self-improving code
11.1 codebase inventory; 11.2 patch synthesis; 11.3 isolated branch; 11.4 independent tests;
11.5 frozen tests; 11.6 benchmark; 11.7 OOD; 11.8 resource; 11.9 restart; 11.10 promote/rollback;
11.11 archive descendants.

### Pass 12 — Open-ended evolution
12.1 candidate archive; 12.2 island diversity; 12.3 migration; 12.4 descendant productivity;
12.5 novelty; 12.6 lineage; 12.7 anti-collapse; 12.8 long-horizon no-reset experiments.

### Pass 13 — Efficiency
13.1 profiler; 13.2 sparse execution; 13.3 compilation cache; 13.4 quantization; 13.5 batching;
13.6 speculative execution; 13.7 adaptive depth; 13.8 energy-aware scheduling.

### Pass 14 — Mobile
14.1 Android harness; 14.2 Termux measurements; 14.3 thermal state; 14.4 battery; 14.5 NPU;
14.6 memory pressure; 14.7 offline operation; 14.8 recovery after process death.

### Pass 15 — Consolidation
15.1 remove dead modules; 15.2 unify versioned interfaces; 15.3 benchmark tiers; 15.4 docs;
15.5 reproducibility; 15.6 release gates.

## Level 2 — Definition of “conditional code god”

The target is not a single giant model. It is a system that can repeatedly:

`understand -> create -> execute -> verify -> diagnose -> repair -> learn -> transfer -> improve itself`

with evidence at every transition and without treating an internal score as proof of success.

## Current implementation state

1. Pass 0: partial / audit inherited from 1.18.
2. Pass 1: partial.
3. Pass 2: **substantially implemented in 1.20**.
4. Pass 3: neural components exist, value-guided execution learning is the next major gap.
5. Passes 4–10: many pieces exist, but composition and causal evidence are incomplete.
6. Pass 11: bounded configuration evolution exists; source-level evolution not yet promoted.
7. Passes 12–15: research scaffolding exists, evidence incomplete.

## Execution rule for future work

Work in passes. Each pass gets:

- implementation block;
- targeted unit/integration tests;
- matched benchmark;
- failure analysis;
- research note;
- percentage completion;
- promotion/rejection decision;
- next-pass input.
