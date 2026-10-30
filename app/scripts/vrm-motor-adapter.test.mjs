import assert from "node:assert/strict";
import test from "node:test";
import { createVrmMotorAdapter } from "../src/components/avatar/vrmMotorAdapter.ts";

function node(name, x = 0, y = 0, z = 0) {
  return { name, rotation: { x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } }, children: [] };
}
function rig(...nodes) {
  return { name: "scene", children: nodes, traverse(fn) { const visit = (n) => { fn(n); for (const child of n.children ?? []) visit(child); }; visit(this); } };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `expected ${actual} to be near ${expected}`);

test("maps VRM and Mixamo humanoid aliases to canonical NK1 channels", () => {
  const head = node("Head"), neck = node("J_Bip_C_Neck"), leftArm = node("mixamorig:LeftArm"), rightForearm = node("RightForeArm");
  const adapter = createVrmMotorAdapter(rig(head, neck, leftArm, rightForearm));
  assert.ok(adapter.capabilities.joints.includes("headYaw"));
  assert.ok(adapter.capabilities.joints.includes("neckPitch"));
  assert.ok(adapter.capabilities.joints.includes("leftShoulderRoll"));
  assert.ok(adapter.capabilities.joints.includes("rightElbowFlex"));
  assert.equal(adapter.capabilities.supportsIk, false);
});

test("applies additive offsets without discarding the animation-mixer base pose", () => {
  const head = node("Head", 0.1, 0.2, -0.1), leftArm = node("LeftUpperArm", 0.3, 0, 0.2);
  const adapter = createVrmMotorAdapter(rig(head, leftArm));
  const result = adapter.applyPose({ headYaw: 0.25, headPitch: -0.05, leftShoulderRoll: 0.1, fingerCurl: 0.4 });
  near(head.rotation.x, 0.05);
  near(head.rotation.y, 0.45);
  near(head.rotation.z, -0.1);
  near(leftArm.rotation.x, 0.3);
  near(leftArm.rotation.z, 0.3);
  assert.deepEqual(result.unsupported, ["fingerCurl"]);
  assert.equal(result.executionStatus, "partial");
});

test("reports unsupported channels and never writes non-finite rotations", () => {
  const adapter = createVrmMotorAdapter(rig(node("Hips")));
  const result = adapter.applyPose({ headYaw: 0.2, leftKneeFlex: Number.NaN });
  assert.deepEqual(result.applied, {});
  assert.deepEqual(result.unsupported, ["headYaw", "leftKneeFlex"]);
  assert.equal(result.executionStatus, "unsupported");
});

test("discovers bilateral VRM J_Bip arm and leg channels without claiming IK", () => {
  const adapter = createVrmMotorAdapter(rig(
    node("J_Bip_L_UpperArm"), node("J_Bip_R_UpperArm"),
    node("J_Bip_L_LowerArm"), node("J_Bip_R_LowerArm"),
    node("J_Bip_L_UpperLeg"), node("J_Bip_R_UpperLeg"),
    node("J_Bip_L_LowerLeg"), node("J_Bip_R_LowerLeg"),
    node("J_Bip_C_Spine"), node("J_Bip_C_Chest"),
  ));
  for (const channel of [
    "leftShoulderPitch", "leftShoulderRoll", "rightShoulderPitch", "rightShoulderRoll",
    "leftElbowFlex", "rightElbowFlex", "leftHipFlex", "rightHipFlex",
    "leftKneeFlex", "rightKneeFlex", "spinePitch",
  ]) assert.ok(adapter.capabilities.joints.includes(channel), `missing ${channel}`);
  assert.equal(adapter.capabilities.supportsIk, false);
});

test("maps the built-in procedural 3D body groups to shared head and shoulder channels", () => {
  const head = node("headIntent", 0.02, -0.03, 0.01);
  const leftArm = node("leftArm", 0, 0, -0.2);
  const rightArm = node("rightArm", 0, 0, 0.2);
  const adapter = createVrmMotorAdapter(rig(head, leftArm, rightArm));
  for (const channel of ["headYaw", "headPitch", "headRoll", "leftShoulderPitch", "leftShoulderRoll", "rightShoulderPitch", "rightShoulderRoll"]) {
    assert.ok(adapter.capabilities.joints.includes(channel), "missing " + channel);
  }
  const result = adapter.applyPose({ headYaw: 0.1, headPitch: -0.05, leftShoulderPitch: 0.2, rightShoulderRoll: -0.1 });
  assert.equal(result.executionStatus, "applied");
  near(head.rotation.y, 0.07);
  near(head.rotation.x, -0.03);
  near(leftArm.rotation.x, 0.2);
  near(rightArm.rotation.z, 0.1);
});
