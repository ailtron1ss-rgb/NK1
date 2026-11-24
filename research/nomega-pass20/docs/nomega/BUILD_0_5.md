# Build 0.5.0 verification

Core legacy/NΩ tests:
- NΩ 0.4 regression: 14/14 PASS after integration fixes.
- New 0.5 suite: 6/6 PASS.

Known legacy contract outside NΩ:
- `tests/test_ladder_contract.py::test_bench_runs` expects the legacy external bench to report 5 cases, while current Nullseed returns 19. This pre-existing mismatch is kept separate from NΩ changes rather than masking it.

The 0.5 research suite produced a 6-case main set with 5/6 verified in the current deterministic environment. Program XOR remains an active NeuralInvent generalization gap; the router is not credited for solving it.
