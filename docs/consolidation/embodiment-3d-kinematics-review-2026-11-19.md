# Embodiment 3D skeletal-kinematics candidate review — 2026-11-19

## Candidate

- PR: #951 — `[NK1][Embodiment] Port isolated 3D skeletal kinematics into canonical source`
- Head branch: `aspect/embodiment-skeletal-3d-kinematics-20261119`
- Exact head: `fff46d54a562ec698a82e86caf1b41f5ab88cffc`
- Base: `workpass70-source` at `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`
- State: Draft / open.

## Files and functional contribution

The PR adds three renderer-neutral mathematical modules:

1. `SkeletalKinematics3D.ts` (169 lines): skeleton validation, quaternion hierarchical forward kinematics, bounded damped-least-squares position IK.
2. `SkeletalMultiEffectorIK3D.ts` (143 lines): one task-space solve for up to six effectors, including shared ancestor joints.
3. `SkeletalPoseIK3D.ts` (137 lines): combined 3D position + quaternion orientation IK.

It adds three test files and a package script, and appends the script to `test:rebuild-recovered`. The code is a distinct capability from the existing 2D/2.5D planar IK and VRM mapping. It is not yet wired to OrganismBus, OrganismState, the cognitive planner, a production actuator, renderer, balance/contact/collision dynamics or device movement.

## Exact-head CI evidence

GitHub Actions query for exact head SHA `fff46d54a562ec698a82e86caf1b41f5ab88cffc` returned 50 workflow runs. The broad `NeuroCore core regression validation` run is **failed**:

- Run: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44461668288
- Job: `targeted-and-regression` (job id `135349662371`).
- Steps through runtime typecheck, memory/learning checks and embodiment restore passed.
- Step `Recovered rebuild, causal replay, avatar storage, and Live2D regressions` failed when it reached the new script.
- The first `SkeletalKinematics3D` suite: 4/4 passed.
- The `SkeletalMultiEffectorIK3D` suite: 3/4 passed, 1 failed.
- The failing case is `multi-effector IK coordinates two branches sharing the same root`.
- The exact assertion result reports both residuals at approximately **0.098612**, while the test requires `<= 0.025`; solver returns `converged=false`, `reason=joint-limits-or-singularity`, after 16 iterations.
- The command chains suites with `&&`, so the pose-IK suite did **not** run in this workflow. Do not mark all three suites as tested.

The same head has other successful Actions runs, but they do not override this exact-head regression failure. The asset-only PR #950 is separate and its exact-head regression runs returned success.

## Technical interpretation

The multi-effector fixture starts with both two-link arms fully extended and all joint angles at zero. At full extension, the elbow-position Jacobian column is zero (the elbow has no first-order leverage to shorten the chain), so a local damped-least-squares update can become trapped at a singular configuration. The observed output is consistent with that failure mode: the solver rotates the shoulder joints, leaves both elbow angles at zero, and stops above tolerance.

This is a concrete reproducible failure, not a stylistic concern. The donor is useful and should be retained, but the PR is **not merge-ready** until the multi-effector solver/test is corrected and the full exact-head workflow is green. A robust fix should either handle singularity escape deterministically or define/test a nonsingular initial-pose contract; changing only the assertion tolerance to accept 0.0986 would weaken the test rather than fix the solver.

## Disposition

- Preserve all three modules, tests, and provenance.
- Keep PR #951 Draft; do not merge while the exact-head CI is red.
- Request a correction to the singular multi-effector case and rerun all three test suites plus the exact-head workflow.
- After CI passes, review whether the library should be ported as a bounded capability into the embodiment aspect branch. Runtime wiring remains a separate follow-up with its own integration tests.

No source files or branch refs were changed during this review. No PR was merged or closed.


## Final status correction — PR #951 subsequently merged

The earlier Draft recommendation above describes the state before the follow-up head was merged. PR #951 was later merged at `2026-11-19T05:14:52Z` with merge commit `aa2b385153ddc316eadf61f87e2c0803d7d59d98`. On exact head `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`, the latest Actions query returned 44 workflow runs, all completed successfully. The corrected fixture removed the fully extended starting-pose singularity from the multi-effector test; the solver's singularity behavior itself was not redesigned. The three modules and all three test files are now in `workpass70-source`.

This merge confirms a tested, bounded 3D kinematics library, not complete embodiment: runtime wiring to OrganismBus/OrganismState, planner/actuator, renderer, balance/contact/collision handling and device movement remains separate work.
