import assert from "node:assert/strict";
import test from "node:test";
import { resolveGlbBodyBoneRotation } from "../src/components/avatar/glbBodyChannelAdapter.ts";

test("maps torso and head channels onto GLB nodes with bounded smooth offsets", () => {
  const channels = { torsoPitch: 0.8, torsoYaw: -0.5, headPitch: -0.7, headYaw: 0.6, headRoll: 0.4 };
  const spine = resolveGlbBodyBoneRotation("mixamorigSpine", channels);
  const head = resolveGlbBodyBoneRotation("mixamorigHead", channels);
  assert.ok(Math.abs(spine.x - 0.176) < 1e-9 && Math.abs(spine.y + 0.12) < 1e-9);
  assert.ok(Math.abs(head.x + 0.154) < 1e-9 && Math.abs(head.y - 0.168) < 1e-9 && Math.abs(head.z - 0.096) < 1e-9);
  const neck = resolveGlbBodyBoneRotation("Neck", channels);
  assert.ok(neck.x > 0 && neck.z > 0);
  assert.ok(neck.y > 0.01 && neck.y < 0.06, "head yaw remains dominant over torso counter-rotation");
});

test("maps left/right arms, wrists, hips, knees and ankles independently", () => {
  const channels = {
    leftShoulder: 0.8, rightShoulder: -0.6,
    leftElbow: 0.7, rightElbow: -0.5,
    leftWrist: 0.4, rightHand: -0.3,
    leftHip: 0.6, rightKnee: 0.7, leftAnkle: -0.5,
  };
  assert.ok(resolveGlbBodyBoneRotation("LeftUpperArm", channels).z > 0);
  assert.ok(resolveGlbBodyBoneRotation("RightShoulder", channels).z < 0);
  assert.ok(resolveGlbBodyBoneRotation("LeftLowerArm", channels).z > 0);
  assert.ok(resolveGlbBodyBoneRotation("RightHand", channels).y < 0);
  assert.ok(resolveGlbBodyBoneRotation("LeftUpperLeg", channels).z > 0);
  assert.ok(resolveGlbBodyBoneRotation("RightLowerLeg", channels).z > 0);
  assert.ok(resolveGlbBodyBoneRotation("LeftFoot", channels).x < 0);
});

test("maps individually authored finger channels and aggregate fallback", () => {
  const individual = resolveGlbBodyBoneRotation("LeftHandIndex1", { leftIndexCurl: 0.75 });
  assert.equal(individual.x, 0.315);
  const aggregate = resolveGlbBodyBoneRotation("RightHandMiddle2", { rightFingers: 0.5 });
  assert.ok(Math.abs(aggregate.x - 0.14) < 1e-9);
  const explicitlyOpen = resolveGlbBodyBoneRotation("LeftHandIndex1", { leftIndexCurl: 0, leftFingers: 0.8 });
  assert.equal(explicitlyOpen.x, 0, "an explicit zero must override aggregate finger curl");
});

test("unrecognized, side-less and non-finite inputs fail closed", () => {
  assert.deepEqual(resolveGlbBodyBoneRotation("unknown_prop", { leftShoulder: 1 }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(resolveGlbBodyBoneRotation("upperArm", { leftShoulder: 1 }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(resolveGlbBodyBoneRotation("RightUpperArm", { rightShoulder: Number.POSITIVE_INFINITY }), { x: 0, y: 0, z: 0 });
  const extreme = resolveGlbBodyBoneRotation("LeftUpperArm", { leftShoulder: 10000 });
  assert.ok(extreme.z <= 0.48 && extreme.z >= -0.48);
});
