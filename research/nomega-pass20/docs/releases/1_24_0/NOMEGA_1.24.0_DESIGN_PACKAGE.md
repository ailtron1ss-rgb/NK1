# NΩ 1.24.0-dev — Design Package

## Purpose

This package records the approved architecture for the next major development pass: Adaptive Learning & Autonomous Improvement.

## Scope of the intended code pass

1. Execution Intelligence 2.0.
2. Partial Program Value 2.0 with batched/cost-aware inference.
3. Autonomous Repair Engine.
4. Adaptive Verifiable Environment Forge 2.0.
5. Continual replay/holdout/OOD/regression pipeline.
6. Self-Improvement Experiment Protocol.
7. Promotion and rollback governance.
8. Metaproductivity tracking.
9. Direct integration into the neural learning path without silently weakening the current verifier.

## Current baseline evidence

Targeted baseline command:

`pytest -q tests/test_partial_program_value_v1.py tests/test_verifiable_environment_forge_v1.py tests/test_counterexample_search_v2.py tests/test_execution_trace_v1.py tests/test_neural_execution_learning_lab_v1.py tests/test_neural_program_trainer_v5.py tests/test_self_evolution_lab_v1.py tests/test_replay_scheduler_and_evolution_diagnostics_1_9_8.py tests/test_nomega_1_15_upgrade.py`

Observed result from the 1.23 archive: **33 passed, 1 failed**.

The failure is a stale legacy version assertion in `tests/test_nomega_1_15_upgrade.py`, which expects `1.18.0-dev` while `core/nomega/version.py` reports `1.23.0-dev`. This is recorded as a repair item; no claim of a fully green baseline is made.

## Implementation-state note

The source tree has **not yet been modified for 1.24 production behavior in this design-gated package**. The reason is procedural: the architecture has been approved conversationally, so the written specification can be produced now; the Superpowers workflow requires user review of the written specification before an implementation plan and code changes are started.

## 100% target definition

NΩ will treat “100%” as completion of the explicit N0–N5 engineering evidence ladder in the 1.24 specification, not as a claim that intelligence is universally measurable or that the research problem is solved.
