# WorkPass89 — continual transfer metrics (2026-10-21)

## Source and source inspection
- Project: ContinualAI/Avalanche — https://github.com/ContinualAI/avalanche
- License: MIT. The upstream license/provenance was retained in the existing WorkPass85 source record.
- Inspected source: https://github.com/ContinualAI/avalanche/blob/master/avalanche/evaluation/metrics/forgetting_bwt.py
- The inspected implementation separates initial and latest values by task/experience, reports a difference only when comparable observations exist, and defines backward transfer as the inverse sign of forgetting. Its evaluation hooks update metrics per task and evaluation stage.
- Adaptation decision: port the transferable metric semantics, not Avalanche's Python plugin lifecycle or framework dependencies. Neuro Kurisu gets a small dependency-free TypeScript tracker with explicit task/stage calls.

## Changes
- Added `runtime/neuro-kurisu/src/organism/learning/ContinualTransferTracker.ts`.
  - Forward transfer: score after prior learning but before training on a task, minus that task's explicit reference baseline.
  - Backward transfer: latest held-out score minus the first post-training held-out score for that task.
  - Keeps signed values, so negative transfer/regression is visible rather than hidden by clamping.
  - Reports per-task values and means, preserves stage-by-stage scalar observations, validates monotonic stage order, and supports validated snapshot/restore/clear.
  - Requires baseline → before-task-training → after-task-training observations; missing comparisons remain `null`, not invented zeroes.
- Added `runtime/neuro-kurisu/tests/p26-continual-transfer-tracker.mjs` covering positive and negative transfer, stage ordering, input validation, snapshots, and reset.
- Updated `.github/workflows/p26-learning-validation.yml` to include the source path and run the regression.

## What improves in plain language
The system can now distinguish three different outcomes: whether old tasks help with a new one, whether later learning improves an already learned task, and whether later learning damages it. This makes replay/continual-learning experiments more informative than loss alone.

## Important measurement rules
- Feed only comparable, task-specific held-out evaluation scores from the trusted evaluator.
- Record the baseline before any relevant training, and the pre-training score after earlier tasks but before the target task is trained. Otherwise forward transfer is not interpretable.
- Scores must use the same definition and scale across stages. These metrics do not improve the learner by themselves and do not automatically connect to the production feedback path.
- A synthetic regression test is a correctness check for bookkeeping, not evidence of real-world learning uplift.

## Verification status
The source, test and workflow changes are committed on `workpass89-avalanche-transfer-metrics`. Test execution, full runtime typecheck and CI status have not yet been confirmed in this report; do not treat them as passing until a workflow run provides evidence.

## Approximate extraction progress
- **About 75% for this narrow metric family**: forward/backward transfer calculations, per-task state, staged observations, validation and persistence are implemented.
- **Not 75% of Avalanche overall**. The metrics are not yet wired to the trusted evaluator or a production learning decision.
- Next useful extraction: task-by-training-stage evaluation matrix and a protocol that feeds the same held-out task set into the transfer tracker and replay ablation benchmark; after that, consider adaptive replay triggered by measured forgetting, with guardrails and a baseline comparison.
