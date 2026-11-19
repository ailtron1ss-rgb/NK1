# 3D kinematics candidate — follow-up after CI rerun (2026-11-19)

## Head update

PR #951 advanced from `fff46d54a562ec698a82e86caf1b41f5ab88cffc` to:

- Current head: `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`
- Base: `workpass70-source` at `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`
- Delta from prior head: one commit, changing only `runtime/neuro-kurisu/tests/skeletal-multi-effector-ik-3d.mjs`.

The change adjusts the test fixture to constrain the shared root and place targets/end-effector offsets so the multi-effector test does not begin at the prior fully extended singular configuration. The three implementation modules are unchanged.

## Exact-head Actions rerun

For exact head `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`:

- Latest Actions query: 44 runs; **43 success, 0 failure, 1 in progress** at the time of this check.
- Run `NeuroCore core regression validation`: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44462043694
- In its `targeted-and-regression` job, step 19, `Recovered rebuild, causal replay, avatar storage, and Live2D regressions`, completed successfully.
- The new test script is appended at the end of `test:rebuild-recovered` and chains all three suites with `&&`. Since step 19 is now successful, the complete `test:skeletal-kinematics-3d` command completed successfully on this exact head (base FK/DLS, multi-effector, and pose-IK suites).
- Subsequent regression steps 20–24 also completed successfully; step 25 was still in progress when sampled.

This supersedes the red result on the previous head. The multi-effector fixture correction is supported by an exact-head CI pass; the broader validation workflow was not yet fully completed at the time of this record.

## Disposition

The previous multi-effector failure is resolved on the new head for the covered regression fixture. Keep the PR Draft until the remaining exact-head workflow completes and the PR is reviewed for dependency, API, numerical-stability and runtime-integration boundaries. The modules remain a bounded kinematics library and are not yet connected to OrganismBus, OrganismState, the cognitive planner, production actuators or a renderer.

No source branch was changed, no PR merged/closed, and no branch deleted.
