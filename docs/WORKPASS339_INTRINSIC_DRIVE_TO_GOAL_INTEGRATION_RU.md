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


## WorkPass344 — align counterfactual scoring with the action that actually ran

B2523 outcome calibration now uses the forecast at the selected horizon for the actual action, not the stored counterfactual leader. A focused test and the broad typecheck/runtime workflow were added for this contract. WorkPass344 requires a new exact-head successful run; no planning-quality uplift is inferred yet.


## WorkPass345 — plan/action skill-credit guard

B273 now preserves the planned first action beside the actual outcome action, reports mismatches, and refuses to create/reinforce a multi-action skill when those differ. Goal learning still records the actual result, and old rows restore with unknown plan provenance instead of invented alignment. The focused and broad exact-head checks are pending; whole-trajectory skill verification remains an open gate.


## WorkPass346 — distinguish observed action primitives from macro-plan candidates

The active B273 skill store now creates only single-action primitives from the actual executed action. Multi-action legacy entries are preserved but no longer affect policy; their count is diagnostic. The focused and broad workflows now include B273 migration, live Core long-cycle and independent synthetic policy checks. Exact-head validation is pending, and genuine multi-step skill promotion still requires observed trajectories.


## WorkPass347 — preserve learning liveness under plan divergence

The broad WorkPass346 run showed that gating atomic skill learning on plan-first-action equality can prevent skill reuse in the live Core when the canonical executor chooses a different action. WorkPass347 now lets an accepted actual outcome train its own one-step primitive without granting credit to unexecuted plan steps. Fresh focused and broad checks are required.


## WorkPass348 — reward/success separation and actual skill-use provenance

Core now passes B273 both the transformed reward scalar (for goal progress) and its separately calibrated success scalar (for primitive quality). B273 no longer counts proposed-plan matches as executions; per-skill/global use counts update only when outcome feedback matches an already-active primitive to the actual action. Historical plan-based counters reset via evidence-version migration, and old histories restore without invented success/use provenance. Exact-head validation is pending.
