# Neural Self-Optimization 1.27 Implementation Plan

> Native execution record for the approved 1.25–1.30 roadmap.

**Goal:** connect measured 1.26 state to a neural meta-controller that proposes equal-budget learning actions while an external verifier remains authoritative.

**Architecture:** state-conditioned neural ensemble → advantage prediction → conservative proposal/defer → equal-budget candidate execution → external gate → persistent transaction commit/rollback → oracle evidence/replay.

**Tasks completed:**

1. RED tests for state-conditioned controller, equal-budget gate and uncertainty defer.
2. Implemented `NeuralSelfOptimizationControllerV2`.
3. RED benchmark test followed by real PyTorch closed-loop benchmark.
4. Fixed candidate-seed contamination and rollback-root-cause defects.
5. Converted controller target from absolute utility to incumbent-relative advantage.
6. Added `defer/no-change` safety action.
7. Ran 3-seed × 4-family evidence benchmark.
8. Updated release metadata, roadmap, research notes and release report.
9. Verified clean extraction, syntax, focused regression and release-critical checks.

**Verification result:** N4 remains unpromoted because the mean executed candidate utility delta is negative despite one reproducible equal-budget positive commit.
