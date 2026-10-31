import assert from "node:assert/strict";
import test from "node:test";
import { resolveVrmMotorFrame } from "../src/components/avatar/motorFrameVrm";

const bone = (name) => ({ name, x: 0, y: 0, z: 0, node: { rotation: { x: 0, y: 0, z: 0 } } });
const bones = [bone("J_Bip_C_Head"), bone("J_Bip_L_UpperArm"), bone("J_Bip_R_UpperArm")];
const command = (overrides = {}) => ({
  jointId: "head.yaw", role: "head.yaw", targetId: "J_Bip_C_Head",
  targetKind: "humanoid-bone", component: "y", value: 0.25,
  valueUnit: "radians", fidelity: "direct", clamped: false, ...overrides,
});
const batch = (overrides = {}) => ({
  version: 1, profileId: "kurisu.vrm.calibrated", modelId: "kurisu-vrm-001",
  renderer: "vrm3d", frameTick: 9, frameAtMs: 450, goalId: "turn-head",
  commands: [command()], unmappedFrameJointIds: [], clampedJointIds: [], ...overrides,
});

test("resolves calibrated VRM MotorFrame commands by exact normalized bone ID", () => {
  const result = resolveVrmMotorFrame(batch(), "kurisu-vrm-001", bones);
  assert.equal(result.ok, true);
  assert.equal(result.frameTick, 9);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].bone, bones[0]);
  assert.equal(result.updates[0].component, "y");
  assert.equal(result.updates[0].value, 0.25);
  assert.equal(bones[0].node.rotation.y, 0, "resolution must not mutate before the caller commits the batch");
});

test("rejects cross-model, cross-renderer and unknown model identities", () => {
  assert.equal(resolveVrmMotorFrame(batch(), "another-model", bones).reason,
    "vrm-motor-model-or-renderer-mismatch");
  assert.equal(resolveVrmMotorFrame(batch({ renderer: "depth2d" }), "kurisu-vrm-001", bones).reason,
    "vrm-motor-model-or-renderer-mismatch");
  assert.equal(resolveVrmMotorFrame(batch(), null, bones).reason,
    "vrm-motor-model-or-renderer-mismatch");
});

test("rejects the whole batch when any bone is missing or ambiguous", () => {
  const two = batch({ commands: [command(), command({
    jointId: "arm.pitch", targetId: "J_Bip_L_UpperArm", component: "z", value: -0.2,
  })] });
  assert.equal(resolveVrmMotorFrame(two, "kurisu-vrm-001", bones.slice(0, 1)).reason,
    "vrm-motor-target-not-found");
  assert.equal(resolveVrmMotorFrame(batch(), "kurisu-vrm-001", [...bones, bone("J-Bip-C-Head")]).reason,
    "vrm-motor-target-ambiguous");
});

test("rejects duplicate channels, invalid units, non-finite values and out-of-range radians", () => {
  assert.equal(resolveVrmMotorFrame(batch({ commands: [command(), command({ jointId: "head.pitch" })] }),
    "kurisu-vrm-001", bones).reason, "vrm-motor-target-channel-duplicate");
  assert.equal(resolveVrmMotorFrame(batch({ commands: [command({ valueUnit: "degrees" })] }),
    "kurisu-vrm-001", bones).reason, "vrm-motor-command-invalid");
  assert.equal(resolveVrmMotorFrame(batch({ commands: [command({ value: 7 })] }),
    "kurisu-vrm-001", bones).reason, "vrm-motor-command-invalid");
  assert.equal(resolveVrmMotorFrame(batch({ frameTick: -1 }), "kurisu-vrm-001", bones).reason,
    "vrm-motor-frame-invalid");
});
