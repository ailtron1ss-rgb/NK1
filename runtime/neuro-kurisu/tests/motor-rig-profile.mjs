import assert from "node:assert/strict";
import {
  CANONICAL_MOTOR_JOINT_ROLES, validateMotorRigProfile, compileMotorJointDefinitions,
  compileSkeletalJoints3D, mapMotorFrameToRendererCommands, describeMotorRigCapabilities
} from "../src/organism/system/MotorRigProfile.ts";

const calibration = { status: "calibrated", evidenceId: "rig.calibration.test-01", calibratedAt: "2026-10-30T12:00:00.000Z", verifierVersion: "test-v1" };
function binding(renderer, targetId, component = "y") {
  return { targetId, targetKind: renderer === "live2d" ? "cubism-parameter" : renderer === "depth2d" ? "depth-rig-node" : "humanoid-bone",
    component: renderer === "live2d" ? "value" : component, scale: 1, offset: 0, minValue: -1, maxValue: 1,
    fidelity: renderer === "live2d" ? "approximate" : "direct", requiredInFrame: true };
}
function joint(id, role, parentId, renderer, targetId, component = "y") {
  return { id, role, parentId, minAngleRad: -1, maxAngleRad: 1, restAngleRad: 0,
    maxSpeedRadPerSec: 2, maxAccelerationRadPerSec2: 8, maxJerkRadPerSec3: 80,
    ...(renderer === "live2d" ? {} : { geometry: { offset: { x: 0, y: 0.2, z: 0 }, axis: { x: 0, y: 1, z: 0 } } }),
    binding: binding(renderer, targetId, component) };
}
function profile(renderer = "vrm3d", status = "calibrated") {
  return { schemaVersion: 1, profileId: "kurisu." + renderer + ".test-v1", modelId: "kurisu.test", revision: 1, renderer,
    coordinateFrame: { handedness: "right", upAxis: "y", forwardAxis: "-z", positionUnit: renderer === "vrm3d" ? "meters" : "normalized", angleUnit: "radians" },
    calibration: status === "calibrated" ? structuredClone(calibration) : { status: "test-fixture" },
    joints: [joint("neck.yaw", "neck.yaw", null, renderer, renderer === "live2d" ? "ParamAngleY" : "neckNode"),
      joint("head.yaw", "head.yaw", "neck.yaw", renderer, renderer === "live2d" ? "ParamAngleX" : "headNode"),
      joint("left.shoulder.pitch", "left.shoulder.pitch", "neck.yaw", renderer, renderer === "live2d" ? "ParamBodyAngleX" : "leftArm", "x")] };
}
function state(id, angleRad, available = true) {
  return { id, angleRad, targetAngleRad: angleRad, velocityRadPerSec: 0, accelerationRadPerSec2: 0, available };
}
function frame(joints) {
  return { version: 1, tick: 3, atMs: 60, goalId: "gesture-01", action: "gesture", phase: "moving", joints,
    reachedJointIds: [], blockedJointIds: [], completion01: 0.5, reason: "test" };
}
assert.equal(CANONICAL_MOTOR_JOINT_ROLES.length, 62);
assert.equal(new Set(CANONICAL_MOTOR_JOINT_ROLES).size, 62);
const vrm = profile();
assert.deepEqual(validateMotorRigProfile(vrm), { ok: true, reason: "valid", jointCount: 3 });
assert.equal(compileMotorJointDefinitions(vrm).length, 3);
assert.equal(compileSkeletalJoints3D(vrm).length, 3);
const mapped = mapMotorFrameToRendererCommands(vrm, frame({
  "neck.yaw": state("neck.yaw", 0.2), "head.yaw": state("head.yaw", -0.3),
  "left.shoulder.pitch": state("left.shoulder.pitch", 0.4), "debug.extra": state("debug.extra", 0)
}));
assert.equal(mapped.ok, true);
assert.equal(mapped.batch.commands[1].value, -0.3);
assert.deepEqual(mapped.batch.unmappedFrameJointIds, ["debug.extra"]);
const caps = describeMotorRigCapabilities(vrm);
assert.equal(caps.supportsContactDynamics, false);
assert.equal(caps.supportsBalanceDynamics, false);
const shared = profile();
shared.joints[1].binding.targetId = "sameHeadBone";
shared.joints[2].binding.targetId = "sameHeadBone";
shared.joints[2].binding.component = "x";
assert.equal(validateMotorRigProfile(shared).ok, true, "one native node can receive distinct axes");
const depth = profile("depth2d");
assert.equal(compileSkeletalJoints3D(depth).length, 3);
const depthRotation = profile("depth2d");
depthRotation.joints[1].binding.component = "rotation";
depthRotation.joints[1].binding.scale = 90;
depthRotation.joints[1].binding.minValue = -90;
depthRotation.joints[1].binding.maxValue = 90;
assert.equal(validateMotorRigProfile(depthRotation).ok, true, "2.5D rig nodes accept calibrated rotation channels");
const depthRotationBatch = mapMotorFrameToRendererCommands(depthRotation, frame({
  "neck.yaw": state("neck.yaw", 0), "head.yaw": state("head.yaw", 0.3),
  "left.shoulder.pitch": state("left.shoulder.pitch", 0)
}));
assert.equal(depthRotationBatch.ok, true);
assert.equal(depthRotationBatch.batch.commands[1].component, "rotation");
assert.equal(depthRotationBatch.batch.commands[1].value, 27);
assert.equal(depthRotationBatch.batch.commands[1].valueUnit, "degrees");
const invalidVrmRotation = profile("vrm3d");
invalidVrmRotation.joints[1].binding.component = "rotation";
assert.match(validateMotorRigProfile(invalidVrmRotation).reason, /component-mismatch/);
const live2d = profile("live2d");
assert.equal(validateMotorRigProfile(live2d).ok, true);
const invalidLive2dTarget = profile("live2d");
invalidLive2dTarget.joints[0].binding.targetId = "window.location";
assert.equal(validateMotorRigProfile(invalidLive2dTarget).reason, "live2d-target-id-invalid");
const outOfRangeLive2d = profile("live2d");
outOfRangeLive2d.joints[0].binding.maxValue = 101;
assert.equal(validateMotorRigProfile(outOfRangeLive2d).reason, "renderer-binding-output-range-invalid");
const outOfRangeDepth = profile("depth2d");
outOfRangeDepth.joints[1].binding.component = "rotation";
outOfRangeDepth.joints[1].binding.minValue = -91;
outOfRangeDepth.joints[1].binding.maxValue = 91;
assert.equal(validateMotorRigProfile(outOfRangeDepth).reason, "renderer-binding-output-range-invalid");
const outOfRangeVrm = profile("vrm3d");
outOfRangeVrm.joints[0].binding.minValue = -7;
outOfRangeVrm.joints[0].binding.maxValue = 7;
assert.equal(validateMotorRigProfile(outOfRangeVrm).reason, "renderer-binding-output-range-invalid");
const live = profile("live2d");
live.joints[0].binding.scale = 30; live.joints[0].binding.minValue = -30; live.joints[0].binding.maxValue = 30;
assert.equal(mapMotorFrameToRendererCommands(live, frame({
  "neck.yaw": state("neck.yaw", 0.5), "head.yaw": state("head.yaw", 0), "left.shoulder.pitch": state("left.shoulder.pitch", 0)
})).batch.commands[0].value, 15);
assert.throws(() => compileSkeletalJoints3D(live), /no-spatial-skeleton/);
const uncalibrated = profile("vrm3d", "test-fixture");
assert.throws(() => compileMotorJointDefinitions(uncalibrated), /not-production-calibrated/);
assert.equal(mapMotorFrameToRendererCommands(uncalibrated, frame({
  "neck.yaw": state("neck.yaw", 0), "head.yaw": state("head.yaw", 0), "left.shoulder.pitch": state("left.shoulder.pitch", 0)
})).ok, false);
const cycle = profile(); cycle.joints[0].parentId = "head.yaw";
assert.match(validateMotorRigProfile(cycle).reason, /parent-cycle/);
const duplicate = profile(); duplicate.joints[1].binding.targetId = duplicate.joints[0].binding.targetId;
assert.match(validateMotorRigProfile(duplicate).reason, /target-channel-duplicate/);
const badAxis = profile(); badAxis.joints[0].geometry.axis = { x: 0, y: 2, z: 0 };
assert.match(validateMotorRigProfile(badAxis).reason, /axis-not-normalized/);
const outside = mapMotorFrameToRendererCommands(vrm, frame({
  "neck.yaw": state("neck.yaw", 1.2), "head.yaw": state("head.yaw", 0), "left.shoulder.pitch": state("left.shoulder.pitch", 0)
}));
assert.match(outside.reason, /outside-profile/);
const missing = mapMotorFrameToRendererCommands(vrm, frame({ "neck.yaw": state("neck.yaw", 0) }));
assert.match(missing.reason, /required-joint-missing/);
console.log("Motor rig profiles: 62 canonical roles; profile, FK/IK compile, renderer mapping, calibration and fail-closed regressions passed.");
