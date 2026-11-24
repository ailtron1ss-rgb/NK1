# NΩ 1.27.0-dev — Neural Self-Optimization

## Implemented

- `core/nomega/neural_self_optimization_controller_v2.py` — state-conditioned neural ensemble, advantage learning, conservative acquisition, equal-budget gate and defer policy.
- `core/nomega/benchmark_1_27_neural_self_optimization.py` — real pre-decision closed-loop benchmark with incumbent reference, neural selection, external commit/rollback, restart check and post-decision oracle evidence.
- New focused tests for controller V2 and benchmark V2.
- Release roadmap updated through 1.30.

## Multi-seed evidence

Seeds: 41, 43, 47. Families: `sum3`, `xor3`, `mul2`, `sub_offset`.

- Equal-budget production accounting: PASS on 3/3 seeds.
- Restart equivalence: PASS on 3/3 seeds.
- Controller fitting: 2 fitted phases per seed.
- Decisions: 10 defer / 1 commit / 1 rollback.
- Best committed equal-budget utility gain: +0.073691 (seed 43, `mul2`).
- Mean selection regret: 0.0710013 across all phases.
- Mean executed candidate-vs-incumbent utility delta: -0.04115.
- N4 promotion: REJECTED.

## Honest boundary

The result proves a working neural proposal/abstention controller with an external safety gate. It does not prove general or optimal self-optimization. N4 requires positive repeated equal-budget learning-efficiency gains on the main NOMEGA stack.

## Verification

Fresh verification includes focused new tests, version-consistency tests, governance checks, compileall, multi-seed benchmark, clean ZIP extraction, integrity and SHA-256 verification. The complete historical suite remains subject to the environment timeout limitation documented in the release evidence.
