# NΩ 1.29 Open-Ended Controlled Capability Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build bounded open-ended capability discovery, gradual-drift continual evaluation, and elastic neural substrate control with external verification gates.

**Architecture:** Add three focused modules and one integration benchmark. Capability discovery uses a primitive operator genome and evolutionary lineage; drift benchmarking hides future phases from the selector; elastic substrate control reuses the existing structural transaction engine and cannot self-promote.

**Tech Stack:** Python 3.11+, PyTorch, existing TinyVM/HVM runtime, pytest.

**Spec:** `docs/superpowers/specs/2026-09-21-open-ended-controlled-capability-evolution-design.md`

## Global Constraints
- Version target: `1.29.0-dev`.
- Candidate generation is bounded by explicit budget and maximum program length 48.
- Safe baseline is mandatory in every discovery pool.
- HVM/TinyVM verification remains external to the proposal model.
- Elastic structure changes use transactional rollback.
- Multi-seed evidence is research-only unless all promotion gates pass.

## Review Focus
- Duplicate semantic candidates must not inflate novelty.
- Hidden future drift phases must not influence selection.
- Structural reject must restore exact masks/weights/state.
- A candidate with higher predicted score but failed verification must not displace safe baseline.
- Large operator depth must not escape the candidate compute budget.

---

### Task 1: Capability Evolver Contracts

**Files:**
- Create: `core/nomega/capability_evolver_v1.py`
- Test: `tests/test_capability_evolver_v1.py`

**Interfaces:**
- `OperatorGenomeV1(primitives: tuple[str,...], max_depth: int, mutation_rate: float)`
- `CapabilityEvolverV1.apply_operator(code, genome) -> Program`
- `CapabilityEvolverV1.discover(...) -> CapabilityDiscoveryReportV1`

- [ ] Write failing tests for genome fingerprint stability, safe baseline presence, bounded mutation, and candidate lineage.
- [ ] Run the tests and confirm missing-module failures.
- [ ] Implement the minimal dataclasses and primitive operator mutation DSL.
- [ ] Implement candidate fingerprinting and novelty scoring.
- [ ] Add deterministic baseline and bounded evolution generations.
- [ ] Run the focused test file to green.

### Task 2: Gradual Drift Benchmark

**Files:**
- Create: `core/nomega/gradual_drift_benchmark_v1.py`
- Test: `tests/test_gradual_drift_benchmark_v1.py`

**Interfaces:**
- `DriftPhaseV1(index, mix, train_rows, holdout_rows)`
- `GradualDriftBenchmarkV1.build_stream(...)`
- `GradualDriftBenchmarkV1.evaluate_strategy(...)`

- [ ] Write failing tests for monotonic drift, hidden future phase handling, and adaptation-lag measurement.
- [ ] Run focused tests to verify RED.
- [ ] Implement deterministic mixed-oracle phases with fixed hidden holdout sets.
- [ ] Implement equal-budget strategy evaluation and lag metrics.
- [ ] Run focused tests to green.

### Task 3: Elastic Neural Substrate Policy

**Files:**
- Create: `core/nomega/elastic_substrate_policy_v1.py`
- Test: `tests/test_elastic_substrate_policy_v1.py`

**Interfaces:**
- `ElasticPlanV1(mode, max_grow, max_prune, target_fraction, reason)`
- `ElasticSubstratePolicyV1.propose(...)`
- `ElasticSubstratePolicyV1.apply(...)`

- [ ] Write failing tests for grow/prune/defer hysteresis and exact rollback.
- [ ] Run focused tests to RED.
- [ ] Implement hysteresis policy and delegation to `StructuralPlasticityControllerV1`.
- [ ] Add restart-equivalence fingerprint checks.
- [ ] Run focused tests to green.

### Task 4: Integrated Evidence Loop

**Files:**
- Create: `core/nomega/open_ended_capability_evolution_loop_v1.py`
- Create: `core/nomega/benchmark_1_29_open_ended_evolution.py`
- Test: `tests/test_open_ended_capability_evolution_loop_v1.py`

- [ ] Write failing integration test for multi-family lineage and promotion reject.
- [ ] Run it to RED.
- [ ] Implement integration using immutable safe baseline, external verifier, drift benchmark, and elastic policy.
- [ ] Run 3-seed benchmark with 4 gradual phases.
- [ ] Record verification, novelty, regret, lag, structural decisions, and rollback counts.
- [ ] Add release report and research notes.

### Task 5: Version and Release Verification

**Files:**
- Modify: `core/nomega/version.py`
- Modify: `tests/test_release_version_consistency_v1.py`
- Create: `docs/releases/1_29_0/NOMEGA_1.29.0_UPGRADE_REPORT.md`
- Create: `docs/research/NOMEGA_1.29_OPEN_ENDED_EVOLUTION.md`

- [ ] Update all canonical release metadata to `1.29.0-dev`.
- [ ] Run version/regression matrix.
- [ ] Run compileall.
- [ ] Run clean-tree extraction tests.
- [ ] Create ZIP, SHA-256, and build manifest.
