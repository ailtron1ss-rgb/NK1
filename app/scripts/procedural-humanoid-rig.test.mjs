import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  clampJointAngle,
  createProceduralHumanoidRig,
  solveTwoBonePlanarIK,
} from "../src/components/avatar/proceduralHumanoidRig.ts";

test("built-in NeuroCore body is a real articulated THREE.Bone hierarchy", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);

  assert.ok(rig.root instanceof THREE.Group);
  assert.ok(rig.skeleton instanceof THREE.Skeleton);
  assert.ok(rig.skeleton.bones.length >= 45, `expected a full body skeleton, got ${rig.skeleton.bones.length}`);
  assert.ok(rig.bones.pelvis instanceof THREE.Bone);
  assert.ok(rig.bones.spineLower instanceof THREE.Bone);
  assert.ok(rig.bones.chest instanceof THREE.Bone);
  assert.ok(rig.bones.head instanceof THREE.Bone);
  assert.equal(rig.bones.leftKnee.parent, rig.bones.leftThigh);
  assert.equal(rig.bones.rightKnee.parent, rig.bones.rightThigh);
  assert.equal(rig.bones.leftForearm.parent, rig.bones.leftUpperArm);
  assert.equal(rig.bones.rightForearm.parent, rig.bones.rightUpperArm);
  assert.ok(rig.bones.leftIndex1 instanceof THREE.Bone);
  assert.ok(rig.bones.rightThumb3 instanceof THREE.Bone);
  assert.ok(rig.meshes.length > 70, `expected skin, clothing, muscle and facial meshes, got ${rig.meshes.length}`);
  assert.ok(scene.children.includes(rig.root));

  rig.dispose();
  assert.equal(scene.children.includes(rig.root), false);
});

test("joint limits clamp unsafe shoulder, elbow, hip and knee angles", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);

  const shoulder = rig.setJoint("leftUpperArm", "z", 99);
  const elbow = rig.setJoint("rightForearm", "z", -99);
  const knee = rig.setJoint("leftKnee", "z", -99);
  const hip = clampJointAngle("rightHip", "x", 99, rig.limits);

  assert.equal(shoulder, rig.limits.leftUpperArm.z[1]);
  assert.equal(elbow, rig.limits.rightForearm.z[0]);
  assert.equal(knee, rig.limits.leftKnee.z[0]);
  assert.equal(hip, rig.limits.rightHip.x[1]);
  assert.equal(rig.bones.leftKnee.rotation.z, rig.limits.leftKnee.z[0]);

  rig.dispose();
});

test("organism motor intent and affect move the skeleton and facial rig", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);

  rig.updatePose({
    awake: true,
    action: "respond",
    emotion: "joy",
    arousal: 0.72,
    energy: 0.8,
    cognitiveLoad: 0.3,
    gazeX: 0.55,
    gazeY: -0.2,
    headTilt: 0.12,
    speaking: true,
    leftArmIntent: -0.62,
    rightArmIntent: 0.48,
    bodyChannels: { leftGrip: 0.7, rightGrip: 0.2, chestPitch: -0.12 },
    deltaSeconds: 1 / 30,
    timeSeconds: 3.5,
  });

  assert.notEqual(rig.bones.head.rotation.y, 0);
  assert.notEqual(rig.bones.chest.rotation.x, 0);
  assert.notEqual(rig.bones.leftUpperArm.rotation.z, 0);
  assert.notEqual(rig.bones.rightUpperArm.rotation.z, 0);
  assert.notEqual(rig.bones.leftIndex2.rotation.z, 0);
  assert.equal(rig.root.userData.poseState.action, "respond");
  assert.equal(rig.root.userData.poseState.emotion, "joy");
  assert.ok(rig.eyeWhites.every((eye) => Number.isFinite(eye.scale.y)));
  assert.ok(Number.isFinite(rig.mouth.scale.y));

  rig.resetPose();
  assert.equal(rig.bones.head.rotation.x, 0);
  assert.equal(rig.bones.leftUpperArm.rotation.z, 0);
  assert.equal(rig.root.userData.poseState, null);

  rig.dispose();
});

test("mirrored left and right arm chains both accept world-space IK targets", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  rig.root.updateMatrixWorld(true);

  const leftTarget = new THREE.Vector3(-0.78, 1.44, 0.02);
  const rightTarget = new THREE.Vector3(0.78, 1.44, 0.02);
  const left = rig.solveArmTarget("left", leftTarget);
  const right = rig.solveArmTarget("right", rightTarget);

  assert.ok(Number.isFinite(left.shoulder));
  assert.ok(Number.isFinite(right.shoulder));
  assert.ok(rig.bones.leftUpperArm.rotation.z < 0 || rig.bones.leftForearm.rotation.z < 0);
  assert.ok(rig.bones.rightUpperArm.rotation.z > 0 || rig.bones.rightForearm.rotation.z > 0);
  assert.ok(rig.bones.leftUpperArm.rotation.z >= rig.limits.leftUpperArm.z[0]);
  assert.ok(rig.bones.rightUpperArm.rotation.z <= rig.limits.rightUpperArm.z[1]);

  rig.dispose();
});

test("solved particle displacements reach the articulated spine, elbow and knee bones", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const particles = {
    chest: { position: { x: 0.025, y: 0.54, z: 0.04 }, target: { x: 0, y: 0.5, z: 0 } },
    leftElbowPoint: { position: { x: -0.52, y: 0.56, z: 0.02 }, target: { x: -0.49, y: 0.51, z: 0 } },
    rightKneePoint: { position: { x: 0.15, y: -0.42, z: 0.035 }, target: { x: 0.14, y: -0.46, z: 0 } },
  };

  rig.updatePose({
    awake: true, action: "inspect", emotion: "curiosity", arousal: 0.5, energy: 0.7,
    cognitiveLoad: 0.2, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0, particles, deltaSeconds: 1 / 60,
  });

  assert.ok(rig.bones.chest.position.x > 0);
  assert.ok(rig.bones.chest.position.y > 0.56);
  assert.ok(rig.bones.chest.position.z > 0);
  assert.ok(rig.bones.leftForearm.position.x < 0);
  assert.ok(rig.bones.rightKnee.position.y < -0.48);
  assert.equal(rig.root.userData.poseState.particleBindingsApplied, 3);

  rig.dispose();
});

test("two-link IK reaches interior targets and safely clamps unreachable targets", () => {
  const reachable = solveTwoBonePlanarIK({ x: 0, y: 0 }, { x: 0.4, y: 0.2 }, 0.34, 0.29, 1);
  const error = Math.hypot(reachable.endEffector.x - 0.4, reachable.endEffector.y - 0.2);
  assert.equal(reachable.reachable, true);
  assert.ok(error < 1e-6, `IK endpoint error was ${error}`);

  const unreachable = solveTwoBonePlanarIK({ x: 0, y: 0 }, { x: 4, y: 0 }, 0.34, 0.29, -1);
  assert.equal(unreachable.reachable, false);
  assert.ok(Number.isFinite(unreachable.shoulder));
  assert.ok(Number.isFinite(unreachable.elbowFlex));
  assert.ok(Math.hypot(unreachable.endEffector.x, unreachable.endEffector.y) <= 0.630001);
});
