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


## WorkPass340 — intention-level motive provenance

B272 goal-history rows now preserve the exact intrinsic drive and bounded support score supplied during generation. This prevents diagnostics from retaining only the latest drive while losing the signal that contributed to an older intention. Older rows restore with neutral zero provenance. Validate the new exact HEAD before marking this follow-up verified.


## WorkPass341 follow-up — autonomous-goal outcome replay guard

B273 now has a durable last-credit tick, validates new outcome inputs before mutation, and blocks duplicate or stale feedback including after restore. The focused workflow includes the regression. Exact-head validation is required for this follow-up; no learning uplift is implied.


## WorkPass342 — regression fixture correction

The first WorkPass287–288 run on commit `67fbc11b4a8dfc7d8f6c8ec7fbea477e0503a2e6` failed because the newly added motive-history fixture referenced `comparisonInput` before its declaration. The runtime code was not reached by that test. The fixture now uses a self-contained valid B272 input; re-run the focused workflow on the new exact HEAD before treating WorkPass340/341 as verified.


## WorkPass343 — full runtime typecheck gate

The WorkPass331 workflow now installs the pinned TypeScript compiler and runs the full runtime semantic typecheck, and it is triggered by the B272/B273 implementation/tests. The step is intentionally not recorded as passed until the exact-head Actions run produces a successful result.
