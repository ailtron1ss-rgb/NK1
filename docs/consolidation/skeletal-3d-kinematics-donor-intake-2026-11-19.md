# 3D skeletal-kinematics donor intake — 2026-11-19

## Source and provenance

This aspect branch is based on the pinned working source commit `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33` and selectively carries three renderer-neutral mathematics modules from the merged PR #862 tree (`main` commit `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`):

- `SkeletalKinematics3D.ts` — donor blob `5901ef0ea65c432f9a80a02defed875869b2c852`
- `SkeletalMultiEffectorIK3D.ts` — donor blob `236ca7a65b4c572e8d9057af38a3c0f3ef808ac5`
- `SkeletalPoseIK3D.ts` — donor blob `0b28cdd978da0b0c644b84b07ac4115ba49acaf2`

The original donor file bytes were copied without implementation edits. The existing donor regression file `tests/skeletal-kinematics-3d.mjs` was also retained.

## Why this is not a duplicate of current source

The source tree already contains:
- `app/src/components/avatar/depthRig.ts`: layered 2.5D rig graph and world-pose transform boundary;
- `app/src/components/avatar/planarArmIK.ts`: confidence- and coordinate-frame-gated 2-link planar IK;
- `app/src/components/avatar/vrmHumanoidRigAdapter.ts`: calibrated mapping of planar arm solutions to VRM shoulder/elbow bones;
- `app/src/components/avatar/motorFrameMapper.ts`: validated motor-frame mapping;
- `runtime/neuro-kurisu/src/organism/system/MotorSchema.ts`: validated cognitive motor/action-schema compilation.

Those contracts do not provide general quaternion-based 3D forward kinematics, arbitrary 3D chain position IK, multi-effector shared-joint IK, or combined position+orientation IK. The donor files therefore add a distinct mathematical capability; they do not replace the existing 2D/2.5D/VRM adapter path.

## Verification added in this intake

- Existing FK/DLS tests retained.
- New multi-effector tests cover coordinated left/right branches with a shared root, caller-input immutability, effector-count and ID bounds, invalid weights/targets, and contiguous-chain validation.
- New pose-IK tests cover simultaneous position/orientation solving, quaternion sign equivalence, joint-limit rejection, and invalid solver inputs.
- Package script `test:skeletal-kinematics-3d` is wired into `test:rebuild-recovered`, which the existing WorkPass71 validation workflow executes. That same workflow runs the runtime TypeScript typecheck.

## Strict scope boundary

This is a bounded, renderer-neutral kinematics library only. It does **not**:
- connect to OrganismBus, OrganismState, the cognitive planner, or production actuator/runtime execution;
- replace existing motor-frame mapping or avatar renderer ownership;
- implement balance, contact dynamics, collision avoidance, force control, device calibration, or real-world movement;
- claim a device/Live2D/VRM end-to-end integration.

The separate PR #862 motor runtime/arbiter branch was not copied. Static review found it imports `MotorFrameChannel.ts` and `MotorRigProfile.ts`, which are absent at the pinned #862 merge tree and at current `workpass70-source`; that donor composition is incomplete and needs its own dependency reconstruction. PR #862's head `6202661ad1dcfa37d314765b45e6d63852053e2d` had no PR-triggered Actions runs or commit status checks returned by GitHub.

## Status

- Donor code copied: yes (three modules + original base test).
- Additional tests authored: yes (multi-effector and pose-IK).
- CI verification: pending the PR's exact-head workflow run.
- Production runtime wiring: not done.
