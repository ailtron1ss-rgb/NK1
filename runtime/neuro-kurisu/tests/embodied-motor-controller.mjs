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


import { MotorGoalArbiter } from "../src/organism/system/MotorGoalArbiter.ts";

test("motor subgoal arbitration reuses basal-ganglia and cerebellar controllers", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  const arbiter = new MotorGoalArbiter(motor);
  const candidates = [
    { id: "candidate.explain", goal: goal(), corticalValue01: .92, predictedUtility01: .9, confidence01: .92, effort01: .2 },
    { id: "candidate.rest", goal: goal({ id: "goal.rest.02", action: "rest", priority: 10, targetJointAnglesRad: { spine: 0 } }), corticalValue01: .35, predictedUtility01: .3, confidence01: .8, effort01: .1 },
  ];
  const result = arbiter.propose(candidates, {
    tick: 1, nowMs: 10, dopamine01: .85, predictionError01: .2, uncertainty01: .12,
    novelty01: .25, energy01: .9, thermal01: .1, cognitiveCapacity01: .9,
    conflict01: .05, goalPressure01: .9,
  });
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.selectedCandidateId, "candidate.explain");
  assert.equal(result.selectedAction, "explain");
  assert.equal(result.ranked.length, 2);
  assert.equal(arbiter.diagnostics().basalGanglia.selections, 1);
  assert.equal(arbiter.diagnostics().cerebellar.predictions, 2);
});

test("motor learning only credits unique independently verified outcomes", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  const arbiter = new MotorGoalArbiter(motor);
  arbiter.propose([{ id: "candidate.explain", goal: goal(), corticalValue01: .9, predictedUtility01: .9, confidence01: .9, effort01: .2 }], {
    tick: 1, nowMs: 10, dopamine01: .8, predictionError01: .2, uncertainty01: .1,
    novelty01: .2, energy01: .9, thermal01: .1, cognitiveCapacity01: .9,
    conflict01: .05, goalPressure01: .9,
  });
  const evidence = { evidenceId: "sensor.motor.outcome.001", action: "explain", predictedUtility01: .7, actualUtility01: .9, surprise01: .2, dopamine01: .8, tick: 2, verified: true, independent: true };
  assert.deepEqual(arbiter.recordVerifiedOutcome({ ...evidence, verified: false }), { accepted: false, reason: "independent-verification-required" });
  assert.deepEqual(arbiter.recordVerifiedOutcome(evidence), { accepted: true, reason: "independently-verified-motor-outcome-credited" });
  assert.deepEqual(arbiter.recordVerifiedOutcome(evidence), { accepted: false, reason: "duplicate-evidence-credit" });
  const diagnostics = arbiter.diagnostics();
  assert.equal(diagnostics.creditedEvidenceCount, 1);
  assert.equal(diagnostics.cerebellar.outcomeUpdates, 1);
  assert.equal(diagnostics.basalGanglia.outcomeUpdates, 1);
});

test("arbiter snapshot preserves evidence deduplication across restart", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  const arbiter = new MotorGoalArbiter(motor);
  const evidence = { evidenceId: "sensor.motor.outcome.002", action: "explain", predictedUtility01: .6, actualUtility01: .8, surprise01: .1, dopamine01: .7, tick: 3, verified: true, independent: true };
  assert.equal(arbiter.recordVerifiedOutcome(evidence).accepted, true);
  const restoredMotor = new EmbodiedMotorController();
  restoredMotor.configureSkeleton(skeleton());
  const restored = new MotorGoalArbiter(restoredMotor);
  restored.restore(arbiter.snapshot());
  assert.deepEqual(restored.recordVerifiedOutcome(evidence), { accepted: false, reason: "duplicate-evidence-credit" });
  assert.equal(restored.diagnostics().cerebellar.outcomeUpdates, 1);
});


test("completed motor goal releases priority arbitration for the next intention", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  motor.setGoal(goal({ targetJointAnglesRad: { spine: .05 } }), 0);
  motor.step(0);
  motor.step(100);
  const next = goal({ id: "goal.listen.04", action: "listen", priority: 5, targetJointAnglesRad: { spine: -.1 } });
  assert.deepEqual(motor.setGoal(next, 100), { accepted: true, reason: "goal-accepted" });
});

test("motor arbiter rejects invalid monotonic context without mutating the controller", () => {
  const motor = new EmbodiedMotorController();
  motor.configureSkeleton(skeleton());
  const arbiter = new MotorGoalArbiter(motor);
  const before = motor.snapshot();
  const result = arbiter.propose([{ id: "candidate.explain", goal: goal(), corticalValue01: .9, predictedUtility01: .9, confidence01: .9, effort01: .2 }], {
    tick: -1, nowMs: NaN, dopamine01: .8, predictionError01: .2, uncertainty01: .1,
    novelty01: .2, energy01: .9, thermal01: .1, cognitiveCapacity01: .9,
    conflict01: .05, goalPressure01: .9,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "invalid-motor-arbitration-context");
  assert.deepEqual(motor.snapshot(), before);
});
