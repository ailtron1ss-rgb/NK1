# WorkPass96 checkpoint — retention, rollback and holdout evaluation

**Date:** 2026-10-20  
**Branch:** `workpass79-cognitive-rebuild`  
**PR:** [#1 — draft, unmerged](https://github.com/ailtron1ss-rgb/NK1/pull/1)

## Implemented

- `runtime/neuro-kurisu/src/organism/learning/P23LearningEngine.ts`: bounded nearest-context skill transfer, gated by held-out validation, promotion state, confidence, validation sample count and five-of-six context-bucket similarity. Transfer is weaker than exact-context skill bias.
- `runtime/neuro-kurisu/src/organism/learning/ParametricPolicyLearner.ts`: malformed persisted weights/biases are normalized to finite values; NaN/Infinity learning-rate and sample-weight inputs no longer poison gradient updates.
- `runtime/neuro-kurisu/tests/p23-true-learning.mjs`: near/distant positive transfer, bounded negative transfer, stale-skill decay/expiry and rollback after deteriorating validation regressions.
- `runtime/neuro-kurisu/tests/p26-true-learning.mjs`: non-finite persistence/training regressions.
- `.github/workflows/workpass95-continual-skill-learning.yml`: checks runtime typecheck, P23 learning, core integration/persistence, P26 holdout generalization, predictive transfer and personal curriculum.
- Research rationale and next steps: [continual skill learning research](CONTINUAL_SKILL_LEARNING_RESEARCH_2026-10-20.md).

## WorkPass96 changes

- Exact-context skill bias now decays with a 30-day half-life and expires after 180 days without fresh validation.
- P23 replay is capped at 64 experiences per large consolidation call, stratified by context/action before prioritizing surprise/age; small batches replay fully.
- Non-finite outcome labels are rejected before entering the learning buffer.
- Fixed a negative-zero edge case so unrelated contexts return numeric `0`, not `-0`.
- Added regression checks that stale skills lose influence and later poor validation revokes promotion.
- The P26 deterministic synthetic holdout enforces greater than 90% generalization accuracy; it is a synthetic benchmark, not real-world capability evidence.
- CI logs exposed a real assertion failure (`-0 !== 0`); the fix is committed and a new run is required to verify the current head.

## Evidence status

- **IMPLEMENTED:** code and regression tests committed to the active work branch.
- **NOT YET VERIFIED:** no claim of passing tests until WorkPass95 Actions completes on the final head.
- **IMPLEMENTED:** bounded negative transfer, retention/forgetting, invalid-feedback rejection, validation-triggered rollback, bounded/stratified replay and deterministic synthetic holdout regression coverage; core restart/persistence integration is wired into CI.
- **VERIFIED ON CODE HEAD `c8d20f5`:** runtime typecheck, P23 learning regression, P23 core persistence/restart integration, P26 parametric holdout/finite-state test, predictive-transfer test and personal-curriculum test all completed successfully in GitHub Actions.
- **OPEN:** independent external outcome grounding for skill promotion; prioritized/balanced replay for large queues; real environment/tool outcome benchmarks; resource efficiency measurement.

## Next code-first steps

1. Confirm exact-head WorkPass95 workflow and fix any failures.
2. Add a promotion gate requiring trustworthy outcome evidence and minimum independent holdout support, without breaking compatibility with existing callers.
3. Implement retention/forgetting and negative-transfer metrics with persisted state and restart tests.
4. Introduce prioritized/balanced replay and controlled ablation against the current replay baseline.
5. Add fixed multi-task holdouts so every learning change is measured against a baseline rather than only synthetic training accuracy.
