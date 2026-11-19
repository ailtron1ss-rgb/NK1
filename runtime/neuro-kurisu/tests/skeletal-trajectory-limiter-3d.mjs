import assert from "node:assert/strict";
import test from "node:test";
import {
  planSkeletalTrajectory3D,
  restTrajectoryState3D,
  runSkeletalTrajectory3D,
  stepSkeletalTrajectory3D,
  toMotorFrameJointSamples3D,
  validateTrajectoryState3D,
} from "../src/organism/system/SkeletalTrajectoryLimiter3D.ts";

const skeleton = () => [
  { id: "torso", offset: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -1.2, maxAngleRad: 1.2, restAngleRad: 0 },
  { id: "shoulder", parentId: "torso", offset: { x: 0, y: 1, z: 0 }, axis: { x: 1, y: 0, z: 0 }, minAngleRad: -2.2, maxAngleRad: 2.2, restAngleRad: 0.1 },
  { id: "elbow", parentId: "shoulder", offset: { x: 0, y: 0.9, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: 0, maxAngleRad: 2.6, restAngleRad: 0.2 },
];

const limits = { maxVelocityRadPerSec: 2.4, maxAccelerationRadPerSec2: 9, maxJerkRadPerSec3: 60 };

test("rest state starts at each joint rest angle inside its own range", () => {
  const state = restTrajectoryState3D(skeleton());
  assert.equal(state.torso.positionRad, 0);
  assert.equal(state.shoulder.positionRad, 0.1);
  assert.equal(state.elbow.positionRad, 0.2);
  for (const row of Object.values(state)) {
    assert.equal(row.velocityRadPerSec, 0);
    assert.equal(row.accelerationRadPerSec2, 0);
  }
});

test("a plan segment obeys every joint limit and never overshoots the target", () => {
  const joints = skeleton();
  const targets = { torso: 0.35, shoulder: -0.6, elbow: 1.1 };
  const plan = planSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, { limits });
  for (const joint of joints) {
    const chain = plan.joints[joint.id];
    assert.ok(chain.durationSec > 0);
    assert.ok(chain.segments.length >= 1 && chain.segments.length <= 2);
    for (const segment of chain.segments) {
      assert.ok(segment.peak.velocityRadPerSec <= limits.maxVelocityRadPerSec + 1e-9, joint.id + " velocity");
      assert.ok(segment.peak.accelerationRadPerSec2 <= limits.maxAccelerationRadPerSec2 + 1e-9, joint.id + " acceleration");
      assert.ok(segment.peak.jerkRadPerSec3 <= limits.maxJerkRadPerSec3 + 1e-9, joint.id + " jerk");
      assert.equal(segment.monotone, true, joint.id + " monotone");
    }
  }
});

test("sampling the plan never exceeds the limits and never passes the target", () => {
  const joints = skeleton();
  const targets = { torso: 0.35, shoulder: -0.6, elbow: 1.1 };
  const plan = planSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, { limits });
  let state = restTrajectoryState3D(joints);
  for (let frame = 0; frame < 400; frame++) {
    const result = stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits, plan });
    for (const row of result.joints) {
      const joint = joints.find((candidate) => candidate.id === row.id);
      assert.ok(Math.abs(row.velocityRadPerSec) <= limits.maxVelocityRadPerSec + 1e-9, row.id + " velocity");
      assert.ok(Math.abs(row.accelerationRadPerSec2) <= limits.maxAccelerationRadPerSec2 + 1e-9, row.id + " acceleration");
      assert.ok(row.positionRad >= joint.minAngleRad - 1e-12);
      assert.ok(row.positionRad <= joint.maxAngleRad + 1e-12);
      // Monotone approach: the joint never moves away from its target.
      const error = Math.abs(targets[row.id] - row.positionRad);
      const previousError = Math.abs(targets[row.id] - state[row.id].positionRad);
      assert.ok(error <= previousError + 1e-9, row.id + " regressed away from target");
    }
    state = result.state;
  }
});

test("a full run settles exactly on the target with zero residual velocity", () => {
  const joints = skeleton();
  const targets = { torso: 0.35, shoulder: -0.6, elbow: 1.1 };
  const run = runSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, 0.016, { maxFrames: 600, limits });
  assert.equal(run.settled, true);
  assert.equal(run.reason, "settled");
  assert.ok(run.frames > 1);
  for (const joint of joints) {
    assert.equal(run.state[joint.id].positionRad, targets[joint.id]);
    assert.equal(run.state[joint.id].velocityRadPerSec, 0);
    assert.equal(run.state[joint.id].accelerationRadPerSec2, 0);
  }
  assert.ok(run.maxAbsVelocityRadPerSec <= limits.maxVelocityRadPerSec + 1e-9);
  assert.ok(run.maxAbsAccelerationRadPerSec2 <= limits.maxAccelerationRadPerSec2 + 1e-9);
  assert.ok(run.maxAbsJerkRadPerSec3 <= limits.maxJerkRadPerSec3 + 1e-6);
});

test("the same plan reached in one coarse step equals the fine-step endpoint", () => {
  const joints = skeleton();
  const targets = { torso: 0.5, shoulder: -0.4, elbow: 1.6 };
  const plan = planSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, { limits });
  const duration = Math.max(...Object.values(plan.joints).map((chain) => chain.durationSec));
  const coarse = stepSkeletalTrajectory3D({
    joints, state: restTrajectoryState3D(joints), targets, dtSeconds: duration, limits, plan,
  });
  assert.equal(coarse.settled, true);
  let fineState = restTrajectoryState3D(joints);
  let finePlan = plan;
  let elapsed = 0;
  while (elapsed + 0.004 < duration - 1e-9) {
    const step = stepSkeletalTrajectory3D({ joints, state: fineState, targets, dtSeconds: 0.004, limits, plan: finePlan });
    fineState = step.state;
    finePlan = step.plan;
    elapsed += 0.004;
  }
  const tail = stepSkeletalTrajectory3D({ joints, state: fineState, targets, dtSeconds: duration - elapsed, limits, plan: finePlan });
  for (const joint of joints) {
    assert.ok(Math.abs(tail.state[joint.id].positionRad - coarse.state[joint.id].positionRad) < 1e-6, joint.id);
  }
});

test("per-joint limits override the global limits field by field", () => {
  const joints = skeleton();
  const targets = { torso: 0.35, shoulder: -0.6, elbow: 1.1 };
  const plan = planSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, {
    limits, perJointLimits: { elbow: { maxVelocityRadPerSec: 0.2 } },
  });
  const elbow = plan.joints.elbow;
  const shoulder = plan.joints.shoulder;
  assert.equal(elbow.segments[0].limits.maxVelocityRadPerSec, 0.2);
  assert.equal(elbow.segments[0].limits.maxAccelerationRadPerSec2, limits.maxAccelerationRadPerSec2);
  assert.equal(elbow.segments[0].limits.maxJerkRadPerSec3, limits.maxJerkRadPerSec3);
  assert.ok(elbow.segments[0].peak.velocityRadPerSec <= 0.2 + 1e-9);
  assert.equal(shoulder.segments[0].limits.maxVelocityRadPerSec, limits.maxVelocityRadPerSec);
});

test("targets outside the joint range are clamped, and a joint that cannot move stays put", () => {
  const joints = skeleton();
  const targets = { elbow: 9, torso: -9 };
  const run = runSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), targets, 0.016, { maxFrames: 900, limits });
  assert.equal(run.state.elbow.positionRad, 2.6);
  assert.equal(run.state.torso.positionRad, -1.2);
  // shoulder has no target so it holds its rest angle with zero motion
  assert.equal(run.state.shoulder.positionRad, 0.1);
});

test("stepping does not mutate caller-owned joints, state, targets or plan", () => {
  const joints = skeleton();
  const state = restTrajectoryState3D(joints);
  const targets = { torso: 0.4, shoulder: 0.3, elbow: 0.8 };
  const plan = planSkeletalTrajectory3D(joints, state, targets, { limits });
  const snapshots = [JSON.stringify(joints), JSON.stringify(state), JSON.stringify(targets), JSON.stringify(plan)];
  const result = stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits, plan });
  assert.equal(JSON.stringify(joints), snapshots[0]);
  assert.equal(JSON.stringify(state), snapshots[1]);
  assert.equal(JSON.stringify(targets), snapshots[2]);
  assert.equal(JSON.stringify(plan), snapshots[3]);
  assert.notEqual(result.state, state);
  assert.notEqual(result.plan, plan);
});

test("repeated identical steps from the same input are deterministic", () => {
  const joints = skeleton();
  const state = restTrajectoryState3D(joints);
  const targets = { torso: 0.5, shoulder: -0.2, elbow: 1.4 };
  const first = stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits });
  const second = stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits });
  assert.deepEqual(second, first);
});

test("a stale plan is replaced when the target changes", () => {
  const joints = skeleton();
  const state = restTrajectoryState3D(joints);
  const first = stepSkeletalTrajectory3D({ joints, state, targets: { elbow: 1.2 }, dtSeconds: 0.016, limits });
  assert.equal(first.replanned, true);
  const continued = stepSkeletalTrajectory3D({
    joints, state: first.state, targets: { elbow: 1.2 }, dtSeconds: 0.016, limits, plan: first.plan,
  });
  assert.equal(continued.replanned, false);
  const retargeted = stepSkeletalTrajectory3D({
    joints, state: continued.state, targets: { elbow: 2.1 }, dtSeconds: 0.016, limits, plan: continued.plan,
  });
  assert.equal(retargeted.replanned, true);
  assert.equal(retargeted.plan.joints.elbow.toRad, 2.1);
});

test("invalid inputs fail closed instead of emitting a pose", () => {
  const joints = skeleton();
  const state = restTrajectoryState3D(joints);
  const targets = { torso: 0.1 };
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0 }), /invalid-3d-trajectory-dt/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 61 }), /invalid-3d-trajectory-dt/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits: { maxVelocityRadPerSec: 0 } }), /invalid-3d-trajectory-limits/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits: { maxJerkRadPerSec3: Number.NaN } }), /invalid-3d-trajectory-limits/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets: { torso: Number.NaN }, dtSeconds: 0.016 }), /non-finite-3d-trajectory-target/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state: { ghost: { positionRad: 0, velocityRadPerSec: 0, accelerationRadPerSec2: 0 } }, targets, dtSeconds: 0.016 }), /unknown-3d-trajectory-joint/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state: { torso: { positionRad: 0, velocityRadPerSec: Number.NaN, accelerationRadPerSec2: 0 } }, targets, dtSeconds: 0.016 }), /non-finite-3d-trajectory-row/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state: [], targets, dtSeconds: 0.016 }), /invalid-3d-trajectory-state/);
  assert.throws(() => validateTrajectoryState3D(joints, null), /invalid-3d-trajectory-state/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, maxPlanDurationSec: 0.02 }), /3d-trajectory-plan-too-long/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, toleranceRad: 0 }), /invalid-3d-trajectory-tolerance/);
  assert.throws(() => stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, maxPlanDurationSec: 900 }), /invalid-3d-trajectory-plan-duration/);
});

test("a frame budget that cannot finish the plan reports exhaustion, not success", () => {
  const joints = skeleton();
  const run = runSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), { elbow: 2.4 }, 0.016, {
    maxFrames: 3, limits,
  });
  assert.equal(run.settled, false);
  assert.equal(run.reason, "frame-budget-exhausted");
  assert.equal(run.frames, 3);
  assert.ok(run.state.elbow.positionRad < 2.4);
  assert.throws(() => runSkeletalTrajectory3D(joints, restTrajectoryState3D(joints), {}, 0.016, { maxFrames: 0 }), /invalid-3d-trajectory-frame-budget/);
});

test("transport rows expose measured state only and keep the target separate", () => {
  const joints = skeleton();
  const state = restTrajectoryState3D(joints);
  const rows = toMotorFrameJointSamples3D(joints, state, { elbow: 9 });
  assert.equal(rows.length, 3);
  const elbow = rows.find((row) => row.id === "elbow");
  assert.equal(elbow.angleRad, 0.2);
  assert.equal(elbow.targetAngleRad, 2.6);
  assert.equal(elbow.available, true);
  assert.ok(Number.isFinite(elbow.velocityRadPerSec));
  assert.ok(Number.isFinite(elbow.accelerationRadPerSec2));
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["accelerationRadPerSec2", "angleRad", "available", "id", "targetAngleRad", "velocityRadPerSec"]);
  }
});

test("a partially known state still emits rows for every skeleton joint", () => {
  const joints = skeleton();
  const rows = toMotorFrameJointSamples3D(joints, { torso: { positionRad: 0.4, velocityRadPerSec: 0.1, accelerationRadPerSec2: 0 } }, {});
  const torso = rows.find((row) => row.id === "torso");
  const elbow = rows.find((row) => row.id === "elbow");
  assert.equal(torso.available, true);
  assert.equal(torso.angleRad, 0.4);
  assert.equal(elbow.available, false);
  assert.equal(elbow.angleRad, 0);
  assert.equal(elbow.targetAngleRad, 0.2);
});

test("a moving joint replans without breaking the velocity, acceleration or jerk budget", () => {
  const joints = skeleton();
  const targets = { elbow: 1.2 };
  let state = restTrajectoryState3D(joints);
  // Start the move, then retarget mid-flight so the plan must honour nonzero v0/a0.
  for (let frame = 0; frame < 10; frame++) {
    state = stepSkeletalTrajectory3D({ joints, state, targets, dtSeconds: 0.016, limits }).state;
  }
  assert.ok(state.elbow.velocityRadPerSec > 0);
  const retargeted = { elbow: 0.05 };
  const run = runSkeletalTrajectory3D(joints, state, retargeted, 0.016, { maxFrames: 600, limits });
  assert.equal(run.settled, true);
  assert.equal(run.state.elbow.positionRad, 0.05);
  assert.ok(run.maxAbsVelocityRadPerSec <= limits.maxVelocityRadPerSec + 1e-9);
  assert.ok(run.maxAbsAccelerationRadPerSec2 <= limits.maxAccelerationRadPerSec2 + 1e-9);
  assert.ok(run.maxAbsJerkRadPerSec3 <= limits.maxJerkRadPerSec3 + 1e-6);
});
