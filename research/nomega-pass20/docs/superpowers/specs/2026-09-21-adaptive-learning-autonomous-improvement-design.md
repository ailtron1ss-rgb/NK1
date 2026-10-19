# NΩ 1.24 Adaptive Learning & Autonomous Improvement — Design Specification

**Date:** 2026-09-21  
**Base:** NΩ 1.23.0-dev  
**Status:** Design approved in conversation; written-spec review required before implementation planning under the project's Superpowers workflow.

## Goal

Turn the current execution-grounded research stack into one measurable adaptive-improvement loop in which neural proposal, execution evidence, partial value estimation, counterexample discovery, repair, environment construction, replay, learning, evaluation, and promotion are connected through explicit interfaces and independent evidence gates.

The goal is not to claim consciousness or a completed general intelligence system. The goal is to make each engineering capability executable, measurable, reproducible, and progressively self-improving. “100%” is defined as completion of the specified engineering gates, not a claim that intelligence itself has a universal measurable ceiling.

## Current starting point

NΩ 1.23 already contains executable components for execution tracing, partial-program value estimation, counterexample search, verifiable environment forging, neural execution-learning experiments, replay, anti-forgetting, causal development planning, and a self-evolution control plane. The 1.23 measurements show that value guidance can prune candidates but is currently slower than the small baseline search, and the environment forge correctly rejects families that do not produce sufficiently hard verified rows. Therefore the next step must optimize the full closed loop rather than simply enabling more neural inference.

A targeted baseline test run on the extracted 1.23 archive produced **33 passed / 1 failed**. The sole failure was a stale legacy assertion expecting `1.18.0-dev` while the package source reports `1.23.0-dev`. This is recorded as a pre-existing release-hygiene defect to repair under TDD in the implementation phase.

## Research-derived design decisions

### 1. Verification-first evolutionary search

AlphaEvolve demonstrates a practical pattern of combining multiple proposal generators, automated evaluators, and an evolutionary archive where high-value programs seed future proposals. NΩ therefore keeps an explicit immutable archive, multiple proposal operators, automated evaluation, diversity preservation, and promotion gates instead of a single greedy self-edit loop.

Source: https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/

### 2. Open-ended self-improvement with lineage

The Darwin Gödel Machine demonstrates iterative self-modification with an archive of agent variants, empirical validation, and sandboxed evaluation. NΩ adopts the lineage/branching/archive principle but restricts promotion to evidence-backed candidate artifacts and does not permit uncontrolled mutation of the canonical runtime.

Source: https://arxiv.org/abs/2505.22954

### 3. Self-improvement must optimize metaproductivity, not only current benchmark score

Huxley-Gödel Machine identifies a mismatch between immediate benchmark performance and the ability of an agent to generate productive descendants. NΩ therefore adds a metaproductivity metric to the evolutionary archive: descendant yield, verified gain per experiment budget, repair success, and transferable improvement become first-class measurements.

Source: https://arxiv.org/abs/2510.21614

### 4. Uncertainty-driven test-time adaptation

Recent work on test-time self-improvement uses model uncertainty to select difficult cases, generate related examples, and adapt using a small number of informative samples. NΩ will use uncertainty, failure density, and novelty to prioritize environments and replay items rather than training uniformly on every observation.

Source: https://arxiv.org/abs/2510.07841

### 5. Verifiable environment synthesis

EvoEnv frames self-improvement as construction of executable environments that preserve a solve–verify asymmetry, with staged validation, difficulty calibration, and novelty checking. NΩ's environment forge will be expanded accordingly, including immutable anchors and solver-relative difficulty bands.

Source: https://arxiv.org/abs/2605.14392

### 6. Environment/policy co-evolution

Agent-World combines environment discovery with continuous self-evolving training and dynamic identification of capability gaps. NΩ will connect the bottleneck detector to the environment forge so that the system actively constructs tasks targeted at its measured blind spots.

Source: https://arxiv.org/abs/2604.18292

### 7. Continual learning requires explicit replay and retention measurement

Recent continual-learning work reinforces the need to retain general capability while learning new distributions. NΩ therefore requires immutable regression anchors, diverse replay, holdout/OOD partitions, restart tests, and explicit forgetting metrics before model promotion.

Source: https://arxiv.org/abs/2508.04676

### 8. Value-based synthesis is especially compatible with executable verification

B-Coder motivates value-based program synthesis where off-policy programs and automatic execution rewards are abundant. NΩ extends this idea from a scalar terminal value to a multi-head execution-grounded estimate that separates correctness, progress, repairability, cost, and uncertainty.

Source: https://arxiv.org/abs/2310.03173

## Architecture

```text
                    ┌─────────────────────────┐
                    │ Developmental Bottleneck │
                    └────────────┬────────────┘
                                 │
                         Experiment Planner
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
        Candidate Generator                    Repair Generator
              │                                     │
              └──────────────────┬──────────────────┘
                                 ↓
                      Execution / Sandbox
                                 ↓
                    Execution Evidence Trace
                                 ↓
             ┌──────────────────┼──────────────────┐
             ↓                  ↓                  ↓
        Partial Value      Failure Class       Cost Signal
             │                  │                  │
             └──────────┬───────┴──────────┬───────┘
                        ↓                  ↓
                 Counterexample      Environment Forge
                        │                  │
                        └────────┬─────────┘
                                 ↓
                         Independent Verify
                                 ↓
                        Comparison / Ablation
                                 ↓
                           Promotion Gate
                                 ↓
              ┌──────────────────┼─────────────────┐
              ↓                  ↓                 ↓
            Replay          Capability         Evolution
            Memory           Registry           Archive
              │                  │                 │
              └──────────────────┴─────────────────┘
                                 ↓
                         Neural Improvement
                                 ↓
                           Next Experiment
```

## Components

### A. Execution Intelligence 2.0

Extend `ExecutionTraceV1` into a stable evidence record containing:

- pre/post state summaries;
- branch and program-counter transitions;
- error class;
- partial output;
- terminal verifier outcome;
- per-step reward/progress annotations;
- cost and timeout fields;
- trajectory fingerprint;
- lineage identifiers linking candidate, repair, environment, and evaluator.

The trace must remain independently reproducible from the verifier path.

### B. Partial Value 2.0

Introduce a `PartialProgramValueV2` interface that predicts at least five quantities:

1. eventual verified success probability;
2. expected remaining progress;
3. estimated repairability;
4. expected execution/verification cost;
5. epistemic uncertainty.

The implementation must support batched inference and a measured break-even decision. Value guidance is active only if expected avoided verifier work exceeds its measured inference cost under the current candidate population.

### C. Repair Engine

Introduce a repair pipeline:

`failure → classification → hypotheses → minimal patch → local verify → counterexample search → independent verify → replay`

Each accepted repair stores the original program, evidence, hypothesis, patch, verification, counterexamples, compute cost, and outcome. Repairs are candidates, not trusted truth.

### D. Adaptive Environment Forge 2.0

The forge must:

- mine current failures and uncertainty;
- generate candidate instances near blind spots;
- validate the reference oracle independently;
- calibrate solver-relative difficulty;
- reject non-novel and redundant rows;
- maintain immutable train/holdout/OOD anchors;
- preserve historical versions so comparisons remain reproducible.

### E. Continual Learning Loop

Partition experience into:

- train replay;
- calibration replay;
- immutable validation;
- immutable holdout;
- OOD;
- regression anchors;
- repair traces;
- environment-construction traces.

Promotion requires no material regression on the immutable sets and explicit restart/reload validation.

### F. Self-Improvement Governance

Every experiment is a first-class object:

```text
ExperimentRequest
→ InterventionHypothesis
→ IsolatedCandidate
→ EvaluationBundle
→ IndependentVerification
→ EffectEstimate
→ PromotionDecision
→ ArchiveRecord
```

The evidence record must contain the baseline and candidate hashes, random seeds, environment IDs, evaluator version, code lineage, training data fingerprints, resource measurements, and exact promotion decision.

### G. Metaproductivity

The archive must record both:

- current capability gain;
- ability to create productive descendants.

Required metrics include verified gain/compute, successful repair rate, descendant yield, diversity of successful branches, transfer gain, regression cost, and time-to-next-improvement.

## Promotion policy

A candidate may be promoted only when all required gates pass:

- targeted tests;
- relevant regression suite;
- immutable holdout non-regression plus required gain where applicable;
- OOD non-regression;
- independent verifier agreement;
- reproducible multi-seed evidence;
- restart/reload continuity;
- latency/resource bound;
- replay/provenance integrity;
- no forbidden capability regression.

Research-only mechanisms remain opt-in until measured benefit is demonstrated. This is especially important for value-guided search because 1.23 observed inference overhead on small search populations.

## Direct neurality milestone

The next large phase after 1.24 is explicitly tied to the project's “real neurality” objective. The milestone is not achieved merely by having neural modules. It is achieved only when the neural subsystem is causally responsible for measurable improvement in executable behavior.

Required evidence ladder:

### N0 — Neural module exists

A trainable neural component is present and executable.

### N1 — Neural output changes decisions

Ablating or freezing the neural component changes candidate selection, routing, synthesis, or repair in a controlled experiment.

### N2 — Neural learning changes verified behavior

Training on execution-grounded data produces a statistically/reproducibly higher held-out verified rate than the frozen baseline.

### N3 — Online adaptation improves unseen tasks

The system learns from new verified experience and improves on an immutable future/holdout distribution without direct task leakage.

### N4 — Neural self-optimization

The neural subsystem can select informative training experiences, adjust learning/search budgets, and improve its own measured efficiency while respecting promotion gates.

### N5 — Continual autonomous improvement

The complete loop repeatedly identifies a bottleneck, generates an intervention, measures its effect, retains beneficial changes, rejects/rolls back regressions, and produces a reproducible gain across multiple cycles.

The engineering target is 100% completion of N0–N5 evidence gates. No stage may be declared complete solely because a neural file or training loop exists.

## Next stages after 1.24

### 1.25 — Neural Causality & Credit Assignment

Connect execution outcomes to token/operation-level training signals; add multi-head value, uncertainty calibration, advantage-like targets, causal ablations, and verified policy improvement.

### 1.26 — Online Continual Learning

Introduce uncertainty-triggered replay, adaptive sample selection, anti-forgetting constraints, frozen evaluation partitions, and automatic rollback of harmful updates.

### 1.27 — Neural Self-Optimization

The learner chooses data mix, curriculum difficulty, exploration budget, model routing, and inference batch size under explicit compute/quality objectives. Optimization itself becomes an evaluated capability.

### 1.28 — Autonomous Repair Learning

Train a neural repair policy directly on verified failure→counterexample→repair trajectories, including backtracking and explicit checkpoint/stop actions.

### 1.29 — Open-Ended Capability Evolution

Branch the research agent and tooling stack into controlled evolutionary lineages. Measure metaproductivity rather than only immediate benchmark score. Candidate architectures are sandboxed and promotion is evidence-gated.

### 1.30 — Integrated Self-Development Loop

Unify bottleneck detection, environment construction, neural learning, repair, search, archive, and governance into recurring controlled development cycles.

### 1.31+ — Expansion toward broad generality

Expand beyond TinyVM/program synthesis into multiple executable domains while preserving the same proof discipline: independent evaluation, transfer, OOD, anti-forgetting, provenance, and rollback.

## Completion metrics

The roadmap reports two separate numbers:

1. **Engineering completion:** percentage of explicitly specified gates satisfied.
2. **Capability measurement:** measured task performance, transfer, efficiency, and autonomy on defined benchmarks.

The first can reach 100% for a release. The second must remain empirical and benchmark-specific.

## Implementation boundary

This document is a validated architecture specification for the next implementation pass. Production changes require a separate implementation plan with TDD tasks, exact files, interfaces, and fresh verification evidence. Experimental modules must not silently replace the current verified runtime path.
