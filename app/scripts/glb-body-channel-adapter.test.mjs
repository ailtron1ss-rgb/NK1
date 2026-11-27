import assert from "node:assert/strict";
import test from "node:test";
import { resolveGlbBodyBoneRotation } from "../src/components/avatar/glbBodyChannelAdapter.ts";

test("maps torso and head channels onto GLB nodes with bounded smooth offsets", () => {
  const channels = { torsoPitch: 0.8, torsoYaw: -0.5, headPitch: -0.7, headYaw: 0.6, headRoll: 0.4 };
  assert.deepEqual(resolveGlbBodyBoneRotation("mixamorigSpine", channels), { x: 0.176, y: -0.12, z: 0 });
  assert.deepEqual(resolveGlbBodyBoneRotation("mixamorigHead", channels), { x: -0.154, y: 0.168, z: 0.096 });
  const neck = resolveGlbBodyBoneRotation("Neck", channels);
  assert.ok(neck.x < 0 && neck.y > 0 && neck.z > 0);
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
  assert.equal(aggregate.x, 0.14);
});

test("unrecognized, side-less and non-finite inputs fail closed", () => {
  assert.deepEqual(resolveGlbBodyBoneRotation("unknown_prop", { leftShoulder: 1 }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(resolveGlbBodyBoneRotation("upperArm", { leftShoulder: 1 }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(resolveGlbBodyBoneRotation("RightUpperArm", { rightShoulder: Number.POSITIVE_INFINITY }), { x: 0, y: 0, z: 0 });
  const extreme = resolveGlbBodyBoneRotation("LeftUpperArm", { leftShoulder: 10000 });
  assert.ok(extreme.z <= 0.48 && extreme.z >= -0.48);
});
