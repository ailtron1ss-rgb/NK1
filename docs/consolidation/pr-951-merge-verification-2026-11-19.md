# Consolidation merge checkpoint — PR #951 — 2026-11-19

## Result

- PR: https://github.com/ailtron1ss-rgb/NK1/pull/951
- Scope: isolated renderer-neutral 3D skeletal kinematics donor port.
- PR state: closed, merged.
- Exact donor HEAD reviewed: 0a289c1ddc4c19da4def7409b4e28ef85cb6854c.
- Squash merge commit: aa2b385153ddc316eadf61f87e2c0803d7d59d98.
- Post-merge verification: live workpass70-source ref resolves to the exact merge SHA; PR API reports merged=true and merge_commit_sha matches.

## Verified payload

GitHub merge commit reports the following 8 changed files:

- docs/consolidation/skeletal-3d-kinematics-donor-intake-2026-11-19.md
- runtime/neuro-kurisu/package.json
- runtime/neuro-kurisu/src/organism/system/SkeletalKinematics3D.ts
- runtime/neuro-kurisu/src/organism/system/SkeletalMultiEffectorIK3D.ts
- runtime/neuro-kurisu/src/organism/system/SkeletalPoseIK3D.ts
- runtime/neuro-kurisu/tests/skeletal-kinematics-3d.mjs
- runtime/neuro-kurisu/tests/skeletal-multi-effector-ik-3d.mjs
- runtime/neuro-kurisu/tests/skeletal-pose-ik-3d.mjs

Blob SHAs from exact-HEAD inspection before merge:

| Path | Blob SHA |
|---|---|
| SkeletalKinematics3D.ts | 5901ef0ea65c432f9a80a02defed875869b2c852 |
| SkeletalMultiEffectorIK3D.ts | 236ca7a65b4c572e8d9057af38a3c0f3ef808ac5 |
| SkeletalPoseIK3D.ts | 0b28cdd978da0b0c644b84b07ac4115ba49acaf2 |
| skeletal-kinematics-3d.mjs | f9c3457f94ef98e5943925792aa9754c56ff17ad |
| skeletal-multi-effector-ik-3d.mjs | 2727f07792ba80c86a7ff675653ceca5539518eb |
| skeletal-pose-ik-3d.mjs | 668da03191ca57b49ce1d5fde516cd562c3958f2 |
| package.json | 563869064e477adf5c13dba1f138d58d15721cc9 |
| donor-intake.md | 2954bc2d2727a6fec4bbbaa08300679ec5196bd3 |

## Verification evidence

- 44 pull-request workflow runs associated with the exact donor HEAD completed successfully; no failures or pending runs remained at the final check.
- Core regression run 44462043694 completed successfully. Its full targeted-and-regression job passed, including runtime typecheck, app typecheck/build, recovered rebuild, and 3D kinematics tests registered in that chain.
- The current source line had two intervening commits after the PR base; compare confirmed those changes were separate avatar sprites and documentation, and GitHub reported the PR mergeable.
- After merge, the source branch points exactly at the returned squash merge SHA and PR metadata confirms merged=true.
- The merge commit has no post-merge workflow runs or status checks yet; no CI result on the new merge SHA is claimed. Exact-HEAD CI evidence is from the reviewed PR head.

## Boundaries retained

- This is a kinematics library merge, not an end-to-end embodiment integration.
- No OrganismBus / OrganismState / planner / production actuator wiring is claimed.
- No contact dynamics, balance, collision, force control, device calibration, or production avatar readiness is claimed.
- The source aspect branch ref has not been deleted. Branch-ref cleanup remains gated on the complete PR/dependency/workflow/reference sweep.

## Consolidation ledger update

Disposition for PR #951: **merged into canonical source**. Transfer verified, source HEAD verified. Runtime integration remains a separate future increment.
