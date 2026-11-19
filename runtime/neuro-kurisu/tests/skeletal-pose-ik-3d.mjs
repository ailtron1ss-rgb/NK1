import assert from "node:assert/strict";
import test from "node:test";
import { solveSkeletalPoseIK3D } from "../src/organism/system/SkeletalPoseIK3D.ts";

const oneJoint = (limits = { minAngleRad: -Math.PI, maxAngleRad: Math.PI }) => [
  { id: "shoulder", offset: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, ...limits },
];
const quarterTurn = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };

test("pose IK solves position and orientation together with unit quaternions", () => {
  const joints = oneJoint();
  const result = solveSkeletalPoseIK3D({
    joints, pose: { shoulder: 0 }, chain: ["shoulder"],
    targetPosition: { x: 0, y: 1, z: 0 }, targetRotation: quarterTurn,
    endEffectorOffset: { x: 1, y: 0, z: 0 },
    maxIterations: 80, positionTolerance: 0.01, orientationToleranceRad: 0.02,
  });
  assert.equal(result.converged, true, JSON.stringify(result));
  assert.ok(result.positionError <= 0.01);
  assert.ok(result.orientationErrorRad <= 0.02);
  assert.ok(Math.abs(result.rotation.z - Math.SQRT1_2) <= 0.02);
  assert.ok(Math.abs(result.rotation.w - Math.SQRT1_2) <= 0.02);
});

test("pose IK treats opposite-sign quaternions as the same orientation", () => {
  const result = solveSkeletalPoseIK3D({
    joints: oneJoint(), pose: { shoulder: Math.PI / 2 }, chain: ["shoulder"],
    targetPosition: { x: 0, y: 0, z: 0 },
    targetRotation: { x: 0, y: 0, z: -Math.SQRT1_2, w: -Math.SQRT1_2 },
    endEffectorOffset: { x: 0, y: 0, z: 0 },
  });
  assert.equal(result.converged, true, JSON.stringify(result));
  assert.ok(result.orientationErrorRad <= 0.035);
});

test("pose IK respects joint limits and reports an unreachable pose", () => {
  const result = solveSkeletalPoseIK3D({
    joints: oneJoint({ minAngleRad: -0.2, maxAngleRad: 0.2 }),
    pose: { shoulder: 0 }, chain: ["shoulder"],
    targetPosition: { x: 0, y: 0, z: 0 },
    targetRotation: quarterTurn,
    endEffectorOffset: { x: 0, y: 0, z: 0 },
    maxIterations: 20,
  });
  assert.equal(result.converged, false);
  assert.ok(result.pose.shoulder <= 0.2 && result.pose.shoulder >= -0.2);
  assert.ok(result.orientationErrorRad > 0.5);
});

test("pose IK rejects invalid quaternions, chains and solver bounds", () => {
  const joints = oneJoint();
  const base = {
    joints, pose: {}, chain: ["shoulder"],
    targetPosition: { x: 0, y: 0, z: 0 }, targetRotation: quarterTurn,
  };
  assert.throws(() => solveSkeletalPoseIK3D({ ...base, targetRotation: { x: 0, y: 0, z: 0, w: 0 } }), /invalid-target-quaternion/);
  assert.throws(() => solveSkeletalPoseIK3D({ ...base, chain: ["missing"] }), /unknown-pose-ik-joint/);
  assert.throws(() => solveSkeletalPoseIK3D({ ...base, damping: 0 }), /invalid-pose-ik-options/);
});
