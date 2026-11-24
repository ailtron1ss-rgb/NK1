# NK1 WorkPass — exact ensemble prediction ticket closure (2026-11-01)

## Defect

The canonical world decision already carries a unique prediction ID. The WorldSubsystemRuntime stores a canonical prediction frame that contains the corresponding WorldModelEnsemble ticket ID.

Before this change, action-outcome feedback ignored the supplied canonical decision ID when updating the ensemble. It called `observeOutcomeForAction(action, actual)`, which selected the oldest pending ticket with the same action. Two overlapping `explore` predictions could therefore have their outcomes applied to each other's model candidates.

## Correction

- Add `WorldModelEnsembleController.resolvePredictionOutcome(predictionId, actual)` to resolve one known pending ticket or report an unresolved outcome without updating unrelated tickets.
- Resolve the ensemble ticket through the canonical prediction frame's `ensemble.predictionId`.
- When a canonical prediction ID was supplied but its stored frame/ticket is absent, fail closed for ensemble calibration; do not guess by action name.
- Preserve the existing action-only FIFO compatibility path only for callers which do not supply a canonical prediction ID.
- Delete the consumed canonical prediction frame to bound the ephemeral correlation map.

## Regression

P2698 now creates two pending `explore` decisions, then completes the second before the first. The test asserts that the second exact ensemble ticket is consumed, the first remains pending, then the first ticket is consumed by its own result. The unified organism runtime workflow executes this test.

Existing P2698 context fixtures were also updated to include the full object fields required by WorldContext validation.

## Limits

This fixes attribution of ensemble learning outcomes. It does not claim better prediction accuracy or a positive memory/learning uplift; those require independent holdout experiments.
