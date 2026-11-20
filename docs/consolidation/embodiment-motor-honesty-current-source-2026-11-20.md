# Embodiment motor-honesty consolidation — 2026-11-20

## Current-source target

- Repository: `ailtron1ss-rgb/NK1`
- Target: `workpass70-source`
- Starting source SHA: `05090fb5634c434245f0f055af6506e21a47d1d2`
- New consolidation branch: `consolidation/embodiment-motor-honesty-current-20261120`

## Donor lineage and reconciliation

Historical donor: PR [#768](https://github.com/ailtron1ss-rgb/NK1/pull/768), branch `workpass71-body-systems`, head `94cf04d7e536b5f5566896f4c42059a4ee1a28e0`.

At intake the donor was **45 commits ahead and 441 behind** the current source, with a common ancestor at `d8902d765ef218a32125567f24345fea77f1c902`. It changes 19 paths. A wholesale merge would reintroduce a substantially stale tree; therefore only byte-reviewed, still-missing behavior is carried forward.

## Selected behavior — five paths

1. `app/src/components/avatar/depthRig.ts`
   - `resolveDepthRigPose()` now builds its `deltas` record with a null prototype.
   - `resolveDepthRigWorldPose()` does the same for composed `transforms`.
   - Legal node identifiers that collide with Object.prototype properties (for example `__proto__` and `constructor`) remain ordinary own keys instead of being dropped or changing an accumulator's prototype.

2. `app/scripts/depth-rig.test.mjs`
   - Adds reserved/prototype-key nodes and verifies pose deltas, composed world transforms and motor-frame mapping preserve those IDs.
   - Changes the empty-map assertion to a key-count assertion because the safe map intentionally has a null prototype.

3. `app/src/components/avatar/planarArmIK.ts`
   - Keeps the requested `target` separate from the actual computed `endEffector`.
   - Adds `limitsApplied` so a joint-clamped solution cannot be mistaken for a successful reach.
   - Keeps the existing input validation, reach clamping, coordinate-frame contract and joint-angle calculation.

4. `app/scripts/planar-arm-ik.test.mjs`
   - Verifies an unconstrained solution reaches the requested point.
   - Verifies a tight shoulder limit reports the actual end-effector shortfall and flags the applied limit.

The donor blobs were compared line-by-line with the current source file contents before selection. The donor versions of these four files differ only by the described additions/replacements.

5. `app/src/components/avatar/embodimentIntentAdapter.ts`
   - `resolveDepthRigPoseFromMotorFrame()` now builds its node-keyed `deltas` dictionary with a null prototype as well.
   - This closes the third path that the new end-to-end regression exposed: the pose and world-transform maps were safe, but the motor-frame adapter still dropped the legal `__proto__` node ID.
   - The first CI run failed on this precise assertion (19/20 depth-rig tests passed); the runtime fix is included rather than weakening the test.

## Deliberately not copied from the 19-path donor

The remaining 15 changed paths (the old body restore sanitizer family, its new helper and integration test, the historical workflow, package-script edits, master-plan document and old changelog text) were not replayed in this batch. They span more subsystems and a 441-commit divergence; each requires a separate current-source semantic and test comparison. In particular, the donor-only `RestoreSanitizers.ts` and restore regression are not represented as merged or verified by this consolidation.

## Existing related source work retained

- PR #574 — motor-frame status-reference integrity, merged 2026-11-01.
- PR #951 — isolated 3D skeletal FK/IK library, merged 2026-11-19.
- PR #957 — bounded 3D joint trajectory limits, merged 2026-11-19.

These remain intact. This consolidation adds two missing correctness boundaries without replacing the newer motor, kinematics or renderer owners.

## Verification boundary

A dedicated current-source workflow runs the app TypeScript check and the two focused depth-rig / planar-arm-IK regressions. No local execution, hosted check result, Release ZIP update, device calibration, renderer readback or physical movement is claimed until the exact new head reports those results.

No source donor branch is deleted or force-pushed.
