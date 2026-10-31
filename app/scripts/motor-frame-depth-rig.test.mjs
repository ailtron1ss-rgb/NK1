import assert from "node:assert/strict";
import test from "node:test";
import { overlayMotorFrameOnDepthRigPose } from "../src/components/avatar/motorFrameDepthRig.ts";

const rest = { x: 0, y: 0, z: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const rig = {
  version: 1, id: "kurisu-depth-rig",
  coordinateSystem: "normalized-y-down",
  nodes: [
    { id: "root", role: "root", parentId: null, depthOrder: 0, pivot: { x: .5, y: .5 }, rest: { ...rest } },
    { id: "torso", role: "torso", parentId: "root", depthOrder: 1, pivot: { x: .5, y: .5 }, rest: { ...rest } },
    { id: "head", role: "head", parentId: "torso", depthOrder: 2, pivot: { x: .5, y: .8 }, rest: { ...rest } },
  ],
};
const basePose = {
  rigId: rig.id,
  deltas: { head: { y: .02, rotation: -4 }, torso: { x: .01 } },
};
const command = (overrides = {}) => ({
  jointId: "head.yaw", role: "head.yaw", targetId: "head",
  targetKind: "depth-rig-node", component: "rotation", value: 18,
  valueUnit: "degrees", fidelity: "direct", clamped: false, ...overrides,
});
const batch = (overrides = {}) => ({
  version: 1, profileId: "kurisu.depth.profile", modelId: rig.id,
  renderer: "depth2d", frameTick: 12, frameAtMs: 600, goalId: "turn-head",
  commands: [command()], unmappedFrameJointIds: [], clampedJointIds: [], ...overrides,
});

test("overlays measured motor channels while preserving semantic channels not mapped by the rig profile", () => {
  const result = overlayMotorFrameOnDepthRigPose(rig, basePose, batch());
  assert.equal(result.ok, true);
  assert.equal(result.frameTick, 12);
  assert.equal(result.appliedCommandCount, 1);
  assert.deepEqual(result.pose.deltas.head, { y: .02, rotation: 18 });
  assert.deepEqual(result.pose.deltas.torso, { x: .01 });
  assert.deepEqual(basePose.deltas.head, { y: .02, rotation: -4 }, "input semantic pose is immutable");
});

test("rejects cross-model, cross-renderer, invalid units and unknown target nodes", () => {
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ modelId: "other-rig" })).reason,
    "motor-profile-does-not-match-depth-rig");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ renderer: "vrm3d" })).reason,
    "motor-profile-does-not-match-depth-rig");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ commands: [command({ valueUnit: "radians" })] })).reason,
    "motor-command-unit-mismatch");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ commands: [command({ targetId: "unbound" })] })).reason,
    "motor-command-target-or-value-invalid");
});

test("rejects duplicate joint/channel mappings and values beyond safe depth-rig bounds", () => {
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({
    commands: [command(), command({ jointId: "head.pitch" })],
  })).reason, "motor-frame-target-channel-duplicate");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({
    commands: [command(), command({ targetId: "torso", component: "rotation", jointId: "torso.yaw" })],
  })).ok, true);
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({
    commands: [command({ value: 91 })],
  })).reason, "motor-command-value-out-of-range");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ frameTick: -1 })).reason,
    "motor-frame-batch-invalid");
});

test("rejects malformed semantic poses before attempting to merge a motor frame", () => {
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, { rigId: "other", deltas: {} }, batch()).reason,
    "depth-rig-semantic-pose-invalid");
  assert.equal(overlayMotorFrameOnDepthRigPose(rig, basePose, batch({ commands: [] })).reason,
    "motor-frame-batch-invalid");
});
