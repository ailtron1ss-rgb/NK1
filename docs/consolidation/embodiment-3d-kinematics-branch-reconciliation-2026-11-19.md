# NK1 3D skeletal kinematics branch reconciliation — 2026-11-19

## Provenance and exact integration

- PR: #951 — `[NK1][Embodiment] Port isolated 3D skeletal kinematics into canonical source`
- Source branch: `workpass70-source`
- Donor/source head: `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`
- Base used by PR: `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`
- Merge time: 2026-11-19T05:14:52Z
- Squash merge commit: `aa2b385153ddc316eadf61f87e2c0803d7d59d98`
- Exact-head workflow query: 44 completed / 44 success / 0 failure.
- Compare from immediately preceding source `0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0` to merge commit: 1 commit ahead / 0 behind, exactly 8 changed files.

This merge was performed on GitHub while this branch-family review was in progress. It is recorded as a repository event, not attributed to this audit pass.

## Files merged

| File | Result |
|---|---|
| `runtime/neuro-kurisu/src/organism/system/SkeletalKinematics3D.ts` | New quaternion FK and position DLS IK |
| `runtime/neuro-kurisu/src/organism/system/SkeletalMultiEffectorIK3D.ts` | New bounded shared-joint multi-effector position solver |
| `runtime/neuro-kurisu/src/organism/system/SkeletalPoseIK3D.ts` | New position + orientation pose solver |
| `runtime/neuro-kurisu/tests/skeletal-kinematics-3d.mjs` | FK / DLS / limits and invalid-skeleton tests |
| `runtime/neuro-kurisu/tests/skeletal-multi-effector-ik-3d.mjs` | Shared-root coordination, caller immutability, count/weight/chain bounds |
| `runtime/neuro-kurisu/tests/skeletal-pose-ik-3d.mjs` | Position/orientation, quaternion sign equivalence, limits and invalid input |
| `runtime/neuro-kurisu/package.json` | Registers a grouped test command and adds it to `test:rebuild-recovered` |
| `docs/consolidation/skeletal-3d-kinematics-donor-intake-2026-11-19.md` | Donor provenance and strict integration boundary |

The three source modules were copied without code edits from the previously merged #862 main-tree donor blobs:
- FK / position DLS: `5901ef0ea65c432f9a80a02defed875869b2c852`
- multi-effector IK: `236ca7a65b4c572e8d9057af38a3c0f3ef808ac5`
- pose IK: `0b28cdd978da0b0c644b84b07ac4115ba49acaf2`

The blobs were checked in the resulting `workpass70-source` after merge and match those donor SHA values.

## Why this is additive, not a duplicate

Current source already has:
- `app/src/components/avatar/depthRig.ts` — layered 2.5D transforms;
- `app/src/components/avatar/planarArmIK.ts` — 2-link planar IK;
- `app/src/components/avatar/vrmHumanoidRigAdapter.ts` — mapping of planar solutions into VRM humanoid bones;
- `app/src/components/avatar/motorFrameMapper.ts` — validated motor-frame mapping;
- `runtime/neuro-kurisu/src/organism/system/MotorSchema.ts` — validated cognitive motor/action schema.

The new modules add general quaternion-based 3D forward kinematics, arbitrary chain 3D positional IK, shared-joint multi-effector IK and combined position+orientation IK. They are a useful mathematical substrate, not a replacement for existing 2D/2.5D/VRM rendering and motor-frame adapters.

## Strict boundary — not yet production embodiment

The merged PR deliberately does not:
- wire the solvers into `OrganismBus`, `OrganismState`, planner or autonomous action execution;
- connect a solver result to a real avatar renderer or device actuator;
- solve balance/contact dynamics, collision avoidance, force limits or device calibration;
- claim measured avatar/voice/live-device E2E.

The result is **code present and tests passing**, not a finished 3D avatar control path. A future integration aspect must define the canonical pose owner, coordinate-frame conventions, body/rig profile mapping, safety envelope and abort semantics, then measure renderer and device behavior. Avoid creating a second independent motor controller.

## Related incomplete donor composition

The original PR #862 also had a separate motor-runtime/arbiter proposal. The donor intake report notes that its composition imported `MotorFrameChannel.ts` and `MotorRigProfile.ts` which were not present in the inspected donor tree or source base. That branch was not folded into #951. Reconstruct that dependency surface separately before attempting runtime wiring; do not infer it was merged with the three math modules.

## Disposition

- Keep the three kinematics modules and their tests in source.
- Keep existing planar/VRM/motor-frame code; no replacement or duplication was found.
- Treat production runtime wiring as a separate future embodiment integration task.
- No old branches were deleted; refs/PR history remain intact.
