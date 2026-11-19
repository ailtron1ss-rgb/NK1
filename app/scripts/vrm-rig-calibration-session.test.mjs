import test from "node:test";
import assert from "node:assert/strict";
import {
  captureVrmRigReferencePose,
  createVrmRigCalibrationSession,
  finalizeVrmRigCalibrationSession,
  serializeVrmRigCalibrationSession,
} from "../src/components/avatar/vrmRigCalibrationSession.ts";

const bone = (name, rotation = { x: 0, y: 0, z: 0 }) => ({ name, rotation });
const context = {
  modelFingerprint: "sha256:measured-model",
  coordinateFrameId: "vrm-root:sha256:measured-model",
  left: { shoulder: bone("LeftUpperArm", { x: 0, y: 0, z: 0.1 }), elbow: bone("LeftLowerArm", { x: 1, y: 0, z: 0 }) },
  right: { shoulder: bone("RightUpperArm", { x: 0, y: 0, z: 0.1 }), elbow: bone("RightLowerArm", { x: 1, y: 0, z: 0 }) },
};
const controls = {
  shoulderAxis: "z", elbowAxis: "x", shoulderSign: 1, elbowSign: -1,
  referenceShoulderAngleRad: 0.5, referenceElbowAngleRad: 0.7,
  shoulderMinRad: -1.2, shoulderMaxRad: 1.2, elbowMinRad: -0.1, elbowMaxRad: 2.4,
};

test("captures immutable bind and fixture poses, preserves provenance and finalizes a model-bound profile", () => {
  const started = createVrmRigCalibrationSession(context, "test-avatar.vrm", "2026-10-30T09:00:00.000Z");
  assert.equal(started.accepted, true);
  if (!started.accepted) return;
  assert.ok(Object.isFrozen(started.session));
  assert.ok(Object.isFrozen(started.session.bindPose.left.shoulder));
  assert.equal(started.session.referencePose, null);

  context.left.shoulder.rotation.z = 0.1 + 0.5 + 0.03;
  context.left.elbow.rotation.x = 1 - 0.7 + 0.03;
  context.right.shoulder.rotation.z = 0.1 + 0.5 - 0.02;
  context.right.elbow.rotation.x = 1 - 0.7 - 0.02;
  const captured = captureVrmRigReferencePose(started.session, context, "fixture-2026-10-a", "2026-10-30T09:02:00.000Z", "Measured on a rigid angle fixture");
  assert.equal(captured.accepted, true);
  if (!captured.accepted) return;
  assert.equal(captured.session.reference?.fixtureId, "fixture-2026-10-a");
  assert.equal(captured.session.reference?.operatorNote, "Measured on a rigid angle fixture");
  const result = finalizeVrmRigCalibrationSession(captured.session, context, { left: controls, right: controls });
  assert.equal(result.accepted, true);
  if (result.accepted) {
    assert.equal(result.profile.modelFingerprint, context.modelFingerprint);
    assert.ok(Math.abs(result.profile.left.shoulderOffsetRad - 0.03) < 1e-9);
    assert.ok(Math.abs(result.profile.right.elbowOffsetRad + 0.02) < 1e-9);
  }
  const sidecar = JSON.parse(serializeVrmRigCalibrationSession(captured.session));
  assert.equal(sidecar.reference.fixtureId, "fixture-2026-10-a");
  assert.equal(sidecar.modelName, "test-avatar.vrm");
});

test("requires an exact model/rig match, a fixture ID and a captured reference before finalization", () => {
  const started = createVrmRigCalibrationSession(context, "avatar.vrm", "2026-10-30T09:00:00.000Z");
  assert.equal(started.accepted, true);
  if (!started.accepted) return;
  assert.deepEqual(finalizeVrmRigCalibrationSession(started.session, context, { left: controls, right: controls }), { accepted: false, reason: "invalid-profile" });
  assert.deepEqual(captureVrmRigReferencePose(started.session, { ...context, modelFingerprint: "sha256:other" }, "fixture", "2026-10-30T09:01:00.000Z"), { accepted: false, reason: "rig-changed" });
  assert.deepEqual(captureVrmRigReferencePose(started.session, context, "", "2026-10-30T09:01:00.000Z"), { accepted: false, reason: "invalid-fixture" });
  const changed = { ...context, left: { ...context.left, elbow: bone("DifferentLeftForearm") } };
  assert.deepEqual(captureVrmRigReferencePose(started.session, changed, "fixture", "2026-10-30T09:01:00.000Z"), { accepted: false, reason: "rig-changed" });
});

test("rejects invalid timestamps and non-finite captured bone rotations", () => {
  assert.deepEqual(createVrmRigCalibrationSession(context, "avatar.vrm", "not-a-date"), { accepted: false, reason: "invalid-timestamp" });
  const invalid = { ...context, right: { ...context.right, elbow: bone("RightLowerArm", { x: Number.NaN, y: 0, z: 0 }) } };
  assert.deepEqual(createVrmRigCalibrationSession(invalid, "avatar.vrm", "2026-10-30T09:00:00.000Z"), { accepted: false, reason: "invalid-context" });
});
