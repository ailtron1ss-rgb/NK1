import assert from "node:assert/strict";
import test from "node:test";
import { EmbodiedMotorController, solvePlanarTwoBoneIK, validateMotorGoal } from "../src/organism/system/EmbodiedMotorController.ts";

const skeleton = () => [
  { id: "root", minAngleRad: -0.2, maxAngleRad: 0.2, maxSpeedRadPerSec: 2 },
  { id: "spine", parentId: "root", restAngleRad: 0, minAngleRad: -0.5, maxAngleRad: 0.5, maxSpeedRadPerSec: 1 },
  { id: "left.shoulder", parentId: "spine", minAngleRad: -1.2, maxAngleRad: 1.2, maxSpeedRadPerSec: 2 },
  { id: "left.elbow", parentId: "left.shoulder", minAngleRad: 0, maxAngleRad: 2.4, maxSpeedRadPerSec: 2 },
];
const goal = (overrides = {}) => ({
  id: "goal.explain.01", action: "explain", source: "organism", priority: 40, confidence01: .9,
  createdAtMs: 0, targetJointAnglesRad: { spine: .4, "left.shoulder": .8, "left.elbow": 1.1 },
  interruptible: true, reason: "explain-with-open-gesture", ...overrides,
});

test("goal validation rejects non-finite values, malformed identifiers and unsafe priority", () => {
  assert.equal(validateMotorGoal(goal()).ok, true);
  assert.equal(validateMotorGoal(goal({ priority: 101 })).reason, "priority-out-of-range");
  assert.equal(validateMotorGoal(goal({ confidence01: NaN })).reason, "confidence-out-of-range");
  assert.equal(validateMotorGoal(goal({ targetJointAnglesRad: { spine: Infinity } })).reason, "invalid-joint-target");
});

test("skeleton validation rejects duplicate joints, missing parents and cycles", () => {
  const motor = new EmbodiedMotorController();
  assert.throws(() => motor.configureSkeleton([{ id: "a", minAngleRad: 0, maxAngleRad: 1, maxSpeedRadPerSec: 1 }, { id: "a", minAngleRad: 0, maxAngleRad: 1, maxSpeedRadPerSec: 1 }]), /duplicate/);
  assert.throws(() => motor.configureSkeleton([{ id: "a", parentId: "missing", minAngleRad: 0, maxAngleRad: 1, maxSpeedRadPerSec: 1 }]), /missing-joint-parent/);
  assert.throws(() => motor.configureSkeleton([{ id: "a", parentId: "b", minAngleRad: 0, maxAngleRad: 1, maxSpeedRadPerSec: 1 }, { id: "b", parentId: "a", minAngleRad: 0, maxAngleRad: 1, maxSpeedRadPerSec: 1 }]), /cycle/);
});

test("goal execution is bounded by joint velocity and respects anatomical limits", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  assert.deepEqual(motor.setGoal(goal(), 0), { accepted: true, reason: "goal-accepted" });
  motor.step(0);
  const first = motor.step(100);
  assert.equal(first.phase, "moving");
  assert.ok(first.joints.spine.angleRad <= .100001);
  assert.ok(first.joints["left.shoulder"].angleRad <= .200001);
  for (let i = 2; i <= 30; i++) motor.step(i * 100);
  const final = motor.step(3100);
  assert.equal(final.phase, "holding");
  assert.ok(Math.abs(final.joints.spine.angleRad - .4) < .002);
  assert.ok(final.joints["left.elbow"].angleRad <= 2.4);
});

test("new goal cannot inherit stale joint targets from a previous goal", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  motor.setGoal(goal(), 0);
  motor.step(0);
  motor.step(100);
  const before = motor.snapshot().joints["left.elbow"].angleRad;
  motor.setGoal(goal({ id: "goal.look.02", action: "look", priority: 45, targetJointAnglesRad: { spine: -.2 } }), 100);
  assert.equal(motor.snapshot().joints["left.elbow"].targetAngleRad, before);
});

test("priority arbitration prevents a lower-priority goal from replacing a protected goal", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  motor.setGoal(goal({ interruptible: false }), 0);
  assert.deepEqual(motor.setGoal(goal({ id: "goal.low.02", priority: 20 }), 10), { accepted: false, reason: "active-goal-protected" });
  assert.deepEqual(motor.setGoal(goal({ id: "goal.high.03", priority: 80 }), 10), { accepted: true, reason: "goal-accepted" });
});

test("expired goals stop safely and monotonic time cannot rewind", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  motor.setGoal(goal({ expiresAtMs: 150 }), 0);
  motor.step(0);
  const expired = motor.step(150);
  assert.equal(expired.phase, "expired");
  assert.equal(expired.goalId, null);
  assert.throws(() => motor.step(149), /monotonic/);
});

test("snapshot restore preserves a bounded in-flight goal", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  motor.setGoal(goal(), 0);
  motor.step(0);
  motor.step(100);
  const restored = new EmbodiedMotorController();
  restored.configureSkeleton(skeleton());
  restored.restore(motor.snapshot());
  assert.equal(restored.snapshot().activeGoal?.id, "goal.explain.01");
  assert.equal(restored.snapshot().joints.spine.angleRad, motor.snapshot().joints.spine.angleRad);
  assert.ok(restored.step(200).joints.spine.angleRad > motor.snapshot().joints.spine.angleRad);
});

test("two-bone IK solves reachable targets and safely clamps unreachable targets", () => {
  const reachable = solvePlanarTwoBoneIK({ upperLength: 1, lowerLength: 1, targetX: 1, targetY: 1 });
  assert.equal(reachable.reachable, true);
  assert.ok(Number.isFinite(reachable.shoulderAngleRad));
  assert.ok(Number.isFinite(reachable.elbowAngleRad));
  const unreachable = solvePlanarTwoBoneIK({ upperLength: 1, lowerLength: 1, targetX: 5, targetY: 0 });
  assert.equal(unreachable.reachable, false);
  assert.ok(unreachable.clampedTarget.x <= 2);
  assert.ok(unreachable.reachError > 2.9);
  assert.throws(() => solvePlanarTwoBoneIK({ upperLength: 0, lowerLength: 1, targetX: 0, targetY: 1 }), /invalid/);
});
