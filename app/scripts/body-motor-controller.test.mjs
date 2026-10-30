import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceJointPose,
  filterPoseForCapabilities,
  resolveMotorProposals,
  solveTwoBoneIK,
} from "../src/components/avatar/bodyMotorController.ts";

const limits = {
  shoulder: { min: -1.2, max: 1.2, maxSpeed: 2 },
  elbow: { min: 0, max: 2.4, maxSpeed: 3 },
};

test("two-bone IK reaches an in-range target with segment lengths preserved", () => {
  const root = [0, 0, 0], target = [1, -1, 0], pole = [0, 0, 1];
  const result = solveTwoBoneIK(root, target, pole, 1, 1);
  const distance = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  assert.equal(result.reachable, true);
  assert.ok(Math.abs(distance(root, result.elbow) - 1) < 1e-8);
  assert.ok(Math.abs(distance(result.elbow, result.target) - 1) < 1e-8);
  assert.deepEqual(result.target, target);
});

test("unreachable and degenerate IK targets are safely projected", () => {
  for (const target of [[20, 0, 0], [0, 0, 0], [NaN, 0, 0]]) {
    const result = solveTwoBoneIK([0, 0, 0], target, [0, 1, 0], 1, 0.75);
    assert.ok(result.elbow.every(Number.isFinite));
    assert.ok(result.target.every(Number.isFinite));
    assert.ok(result.clampedDistance <= 1.75);
    assert.ok(result.clampedDistance >= 0.25);
  }
});

test("highest-priority intent wins and equal-priority proposals blend deterministically", () => {
  const result = resolveMotorProposals([
    { source: "gesture", priority: 60, joints: { shoulder: 1, elbow: 0.8 } },
    { source: "safety", priority: 100, joints: { shoulder: -0.4 } },
    { source: "social", priority: 60, weight: 1, joints: { elbow: 0.2 } },
  ], limits);
  assert.equal(result.pose.shoulder, -0.4);
  assert.equal(result.pose.elbow, 0.5);
  assert.deepEqual(result.owners.shoulder, ["safety"]);
  assert.deepEqual(result.owners.elbow, ["gesture", "social"]);
});

test("unsupported joints and non-finite proposals fail closed with reasons", () => {
  const result = resolveMotorProposals([
    { source: "planner", priority: 20, joints: { finger: 0.5, shoulder: Infinity } },
  ], limits);
  assert.equal("finger" in result.pose, false);
  assert.equal("shoulder" in result.pose, false);
  assert.deepEqual(result.rejected.map((entry) => entry.reason).sort(), ["joint-not-supported", "non-finite-target-or-priority"]);
});

test("joint advancement is speed-limited, bounded and robust to invalid delta time", () => {
  const next = advanceJointPose({ shoulder: 0 }, { shoulder: 2, elbow: -1 }, limits, 0.05);
  assert.equal(next.shoulder, 0.1);
  assert.equal(next.elbow, 0);
  assert.equal(advanceJointPose({}, { shoulder: 1 }, limits, Infinity).shoulder, 0);
});

test("capability filtering exposes unsupported body channels instead of claiming execution", () => {
  const result = filterPoseForCapabilities(
    { headYaw: 0.2, leftIndex: 0.4, rightElbow: 0.8 },
    { joints: ["headYaw", "rightElbow"], expressions: ["smile"], supportsIk: true, supportsWorldInteraction: false, supportsClothingLayers: false },
  );
  assert.deepEqual(result.supported, { headYaw: 0.2, rightElbow: 0.8 });
  assert.deepEqual(result.unsupported, ["leftIndex"]);
});
