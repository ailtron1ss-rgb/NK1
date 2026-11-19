import assert from "node:assert/strict";
import test from "node:test";
import { solveMultiEffectorIK3D } from "../src/organism/system/SkeletalMultiEffectorIK3D.ts";

const skeleton = () => [
  { id: "root", offset: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: 0, maxAngleRad: 0 },
  { id: "left.shoulder", parentId: "root", offset: { x: -1, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -2.8, maxAngleRad: 2.8 },
  { id: "left.elbow", parentId: "left.shoulder", offset: { x: -1, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -2.8, maxAngleRad: 2.8 },
  { id: "right.shoulder", parentId: "root", offset: { x: 1, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -2.8, maxAngleRad: 2.8 },
  { id: "right.elbow", parentId: "right.shoulder", offset: { x: 1, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -2.8, maxAngleRad: 2.8 },
];

const effectors = () => [
  {
    id: "left-hand", chain: ["root", "left.shoulder", "left.elbow"],
    target: { x: -2.791886, y: 0.179833, z: 0 }, endEffectorOffset: { x: -1, y: 0, z: 0 },
  },
  {
    id: "right-hand", chain: ["root", "right.shoulder", "right.elbow"],
    target: { x: 2.791886, y: 0.179833, z: 0 }, endEffectorOffset: { x: 1, y: 0, z: 0 },
  },
];

test("multi-effector IK coordinates two branches sharing the same root", () => {
  const joints = skeleton();
  const result = solveMultiEffectorIK3D({
    joints, pose: {}, effectors: effectors(), maxIterations: 96, tolerance: 0.025,
  });
  assert.equal(result.converged, true, JSON.stringify(result));
  assert.equal(result.residuals.length, 2);
  assert.ok(result.maxError <= 0.025);
  assert.ok(result.residuals.every(row => row.error <= 0.025));
  for (const joint of joints) {
    const angle = result.pose[joint.id] ?? 0;
    assert.ok(angle >= joint.minAngleRad && angle <= joint.maxAngleRad, joint.id);
  }
});

test("multi-effector IK does not mutate caller-owned joints, effectors or pose", () => {
  const joints = skeleton();
  const targets = effectors();
  const pose = { "root": 0, "left.shoulder": 0.1 };
  const before = JSON.stringify({ joints, targets, pose });
  solveMultiEffectorIK3D({ joints, pose, effectors: targets, maxIterations: 3 });
  assert.equal(JSON.stringify({ joints, targets, pose }), before);
});

test("multi-effector IK rejects too many effectors, duplicate IDs and invalid weights", () => {
  const joints = skeleton();
  const base = effectors();
  assert.throws(() => solveMultiEffectorIK3D({
    joints, pose: {}, effectors: Array.from({ length: 7 }, (_, i) => ({ ...base[0], id: "effector-" + i })),
  }), /effector-count/);
  assert.throws(() => solveMultiEffectorIK3D({
    joints, pose: {}, effectors: [base[0], { ...base[1], id: base[0].id }],
  }), /duplicate-multi-ik-effector/);
  assert.throws(() => solveMultiEffectorIK3D({
    joints, pose: {}, effectors: [{ ...base[0], weight: 0 }],
  }), /invalid-multi-ik-weight/);
});

test("multi-effector IK rejects non-contiguous chains and malformed numeric targets", () => {
  const joints = skeleton();
  const base = effectors();
  assert.throws(() => solveMultiEffectorIK3D({
    joints, pose: {}, effectors: [{ ...base[0], chain: ["root", "left.elbow"] }],
  }), /chain-not-contiguous/);
  assert.throws(() => solveMultiEffectorIK3D({
    joints, pose: {}, effectors: [{ ...base[0], target: { x: Number.NaN, y: 0, z: 0 } }],
  }), /invalid-multi-ik-effector/);
});
