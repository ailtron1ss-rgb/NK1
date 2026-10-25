# WorkPass339 — intrinsic motivation to endogenous goal integration

Date: 2026-10-25

## Defect found

The live `OrganismCore` cycle generated a B272 endogenous goal before updating the current cycle's `IntrinsicMotivationEngine` state. Although B272 accepted `intrinsicDrive01` and `intrinsicDriveConfidence01`, the canonical call site supplied neither value. The existing unit test proved the optional input affected isolated B272 scoring, but did not prove the live Core path delivered it.

## Change

- Move the single canonical intrinsic-drive update before B272 goal generation. The same updated drive continues to feed intrinsic-goal proposals later in the cycle; the engine is not duplicated.
- Pass `intrinsicState.overall` into B272 with a bounded support score derived from world-evidence availability and inverse prediction error. This is an internal ranking signal, not external verification.
- Persist the last consumed drive and support score in B272 state/diagnostics. Old snapshots remain compatible: absent fields restore to zero.
- Extend the live Core regression to call `observe(..., 'operational')` and compare the drive consumed by B272 with the canonical intrinsic state from that same cycle.
- Add the live integration regression to the Node 24 WorkPass287–288 workflow path filters and run steps.

## Verification status

The source edit and regression wiring have been authored on `workpass339-intrinsic-drive-goal-bridge-2026-10-25`. Exact-head tests/typecheck and GitHub Actions must complete before calling this change validated. No learning uplift, autonomous efficacy or production-readiness claim is made by this integration fix.

## Next

After the focused workflow passes, continue the causal-memory track: bind each self-generated intention to the prediction that motivated it, the executed action, the verified outcome and a revision/abandonment reason. Keep this in the existing canonical event/goal owners rather than introducing a second intention store.
