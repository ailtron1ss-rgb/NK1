# 3D joint trajectory limits — 2026-11-19

## Gap this closes

`SkeletalKinematics3D`, `SkeletalPoseIK3D` and `SkeletalMultiEffectorIK3D` answer three questions: where an end effector is for a pose, which pose reaches a position target, and which pose reaches a position and orientation target. None of them answers the question a motor controller has to answer: which intermediate poses may be commanded between the current state and the target without exceeding the joint's velocity, acceleration and jerk budget.

The 75-aspect tracker lists `motor` limits as implemented, but no code in the tree implemented any jerk bound: a repository-wide search for `jerk` returned nothing before this change. IK output was therefore a target pose that could be commanded as a single step, which is exactly the discontinuity a physical or animated actuator cannot follow.

## What was added

`runtime/neuro-kurisu/src/organism/system/SkeletalTrajectoryLimiter3D.ts` — a renderer-neutral, bounded trajectory layer over the existing skeleton model:

- **Analytic quintic segments.** Each joint gets `p(tau) = c0 + c1*tau + ... + c5*tau^5` with `tau = t/T`, fixed by six boundary conditions: measured position, velocity and acceleration at plan start, and target position with zero velocity and zero acceleration at plan end.
- **Duration solved for the limits, not guessed.** `T` is the shortest duration for which sampled peak velocity, acceleration and jerk stay inside the joint's limits. Peaks decay as `1/T`, `1/T^2` and `1/T^3`, so feasibility is monotone in `T` and a bisection finds the minimum. When even the longest candidate violates a limit, the request throws `3d-trajectory-limits-unreachable` instead of emitting a pose.
- **No overshoot from rest.** The plan prefers the shortest duration that is also monotone in position, so a joint commanded from rest approaches its target without passing it.
- **Honest mid-flight replan.** A fixed-endpoint quintic cannot honour an arbitrary `(v0, a0)` pair, because its initial-velocity term grows with `T`. When a replan is infeasible, the chain first executes a quartic brake to rest — where the stopping position follows from the duration as `p1 = p0 + v0*T/2 + a0*T^2/12` — and then moves from rest. This is a two-segment chain, not a hidden overshoot.
- **Deterministic, resumable sampling.** The plan is plain data, so a step depends only on the plan and elapsed time, not on frame cadence. A coarse single step and many fine steps reach the same endpoint, and a plan survives persistence.
- **Fail-closed inputs.** Invalid `dt`, limits, targets, joint IDs, state rows, tolerances and plan durations throw named errors. Caller-owned `joints`, `state`, `targets` and `plan` are never mutated.
- **Transport projection.** `toMotorFrameJointSamples3D` emits rows shaped exactly like the app-side `MotorFrameJointSample`, with measured angle separate from target angle, so the existing `mapMotorFrameToSemanticPose` validator accepts them unchanged.

## Verification

`tests/skeletal-trajectory-limiter-3d.mjs` — 15 behavioral tests:

- plan segments and every sampled frame stay inside velocity, acceleration and jerk limits;
- sampled position never regresses away from the target;
- a full run settles exactly on the target with zero residual velocity and acceleration;
- a coarse single step and a fine-stepped run reach the same endpoint;
- per-joint limits override global limits field by field;
- out-of-range targets are clamped and an untargeted joint holds rest;
- stepping does not mutate caller-owned inputs;
- repeated identical steps are deterministic;
- a stale plan is replaced on retarget, a matching plan is continued;
- invalid inputs fail closed with named errors;
- a frame budget that cannot finish reports `frame-budget-exhausted`, not success;
- transport rows carry measured state only;
- a partially known state still emits a row for every joint;
- a moving joint replans without breaking the velocity, acceleration or jerk budget.

`npm run test:skeletal-trajectory-3d` is wired into `test:rebuild-recovered`, which the existing WorkPass71 validation workflow executes on exact head, alongside the runtime `tsc` typecheck (`tsconfig.clean.json`, strict) and the app script suite.

## Strict scope boundary

This is a bounded, renderer-neutral trajectory planner only. It does **not**:

- connect to `OrganismBus`, `OrganismState`, the cognitive planner, `CerebellarBasalGangliaMotorLoop`, or production actuator execution;
- replace `motorFrameMapper`, `planarArmIK`, `vrmHumanoidRigAdapter` or any avatar renderer ownership;
- implement physics, contact, collision avoidance, force control, balance or device calibration;
- claim a device, Live2D or VRM end-to-end integration;
- prove that any body followed a commanded trajectory. `rendererPoseVerified` stays `false` in the app-side mapper, and this module makes no presentation claim.

Collision and self-intersection avoidance remain unimplemented: a monotone joint-space path is not a collision-free Cartesian path.

## Status

- Module implemented: yes.
- Tests authored and passing: yes (15/15 local; app suite 492/492; runtime strict `tsc` pass).
- Production runtime wiring: not done.
- Device/Live2D/VRM end-to-end evidence: none.
