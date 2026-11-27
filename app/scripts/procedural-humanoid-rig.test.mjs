import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  clampJointAngle,
  createProceduralHumanoidRig,
  solveTwoBonePlanarIK,
} from "../src/components/avatar/proceduralHumanoidRig.ts";
import {
  AVATAR_ARTICULATED_BODY_PARTICLE_COUNT,
  AVATAR_ARTICULATED_BODY_SEGMENT_COUNT,
  createAvatarArticulatedBodyState,
  stepAvatarArticulatedBody,
} from "../src/components/avatar/articulatedBodyParticles.ts";

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
  assert.ok(rig.partCount >= 90, `expected at least 90 anatomical parts, got ${rig.partCount}`);
  assert.ok(rig.meshes.length >= 15 && rig.meshes.length <= 30,
    `expected 15–30 GPU skin batches for the anatomical part set, got ${rig.meshes.length}`);
  assert.ok(rig.meshes.every((mesh) => mesh instanceof THREE.SkinnedMesh),
    "all rendered body batches must use the real THREE.SkinnedMesh pipeline");
  assert.ok(rig.meshes.every((mesh) => mesh.geometry.getAttribute("skinIndex") && mesh.geometry.getAttribute("skinWeight")),
    "every merged body batch must carry GPU bone indices and weights");
  assert.ok(rig.meshes.some((mesh) => {
    const weights = mesh.geometry.getAttribute("skinWeight");
    for (let i = 0; i < weights.count; i++) if (weights.getY(i) > 0.01) return true;
    return false;
  }), "adjacent-bone blending weights must be present");
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
  assert.ok(rig.bones.leftUpperArm.rotation.z > 0 || rig.bones.leftForearm.rotation.z > 0);
  assert.ok(rig.bones.rightUpperArm.rotation.z < 0 || rig.bones.rightForearm.rotation.z < 0);
  assert.ok(rig.bones.leftUpperArm.rotation.z >= rig.limits.leftUpperArm.z[0]);
  assert.ok(rig.bones.rightUpperArm.rotation.z <= rig.limits.rightUpperArm.z[1]);

  rig.dispose();
});

test("missing particle frames and reset restore the original bind pose", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const shoulder = rig.bones.leftUpperArm.position.clone();
  const hip = rig.bones.leftHip.position.clone();

  rig.updatePose({
    awake: true, action: "respond", emotion: "calm", arousal: 0.4, energy: 0.7,
    cognitiveLoad: 0.2, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0,
    particles: {
      leftShoulderPoint: { position: { x: -0.29, y: 0.53, z: 0.04 }, target: { x: -0.22, y: 0.48, z: 0 } },
      leftHipPoint: { position: { x: -0.19, y: -0.04, z: 0.04 }, target: { x: -0.12, y: -0.04, z: 0 } },
    },
    deltaSeconds: 1 / 60,
  });
  assert.ok(rig.bones.leftUpperArm.position.distanceTo(shoulder) > 0);
  assert.ok(rig.bones.leftHip.position.distanceTo(hip) > 0);

  rig.updatePose({
    awake: true, action: "rest", emotion: "calm", arousal: 0.2, energy: 0.7,
    cognitiveLoad: 0.1, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0, deltaSeconds: 1 / 60,
  });
  assert.ok(rig.bones.leftUpperArm.position.distanceTo(shoulder) < 1e-8);
  assert.ok(rig.bones.leftHip.position.distanceTo(hip) < 1e-8);

  rig.bones.leftUpperArm.position.x += 0.1;
  rig.resetPose();
  assert.ok(rig.bones.leftUpperArm.position.distanceTo(shoulder) < 1e-8);
  rig.dispose();
});

test("real particle physics output drives the NeuroCore skeleton end to end", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const start = createAvatarArticulatedBodyState();
  assert.equal(start.particleCount, AVATAR_ARTICULATED_BODY_PARTICLE_COUNT);
  assert.equal(start.segments.length, AVATAR_ARTICULATED_BODY_SEGMENT_COUNT);

  const step = stepAvatarArticulatedBody(start, {
    torsoPitch: 0.55,
    torsoYaw: -0.18,
    leftShoulder: 0.74,
    leftElbow: 0.42,
    rightShoulder: -0.35,
    rightElbow: 0.22,
    leftIndexCurl: 0.72,
    rightThumbCurl: 0.38,
    rootYaw: 0.24,
  }, 33.3, { awake: true, energy01: 0.86 });

  assert.equal(step.state.particleCount, AVATAR_ARTICULATED_BODY_PARTICLE_COUNT);
  assert.equal(step.state.segments.length, AVATAR_ARTICULATED_BODY_SEGMENT_COUNT);
  assert.equal(step.jointLimits.maxFlexionDeg, 150);
  assert.ok(Number.isFinite(step.jointLimits.maxCorrectionDeg));
  assert.equal(typeof step.contacts.leftFoot, "boolean");
  assert.equal(typeof step.contacts.rightFoot, "boolean");
  assert.ok(Number.isFinite(step.maxConstraintError));
  assert.ok(Object.keys(step.channels).length > 20);

  rig.root.rotation.y = Number(step.channels.rootYaw ?? 0) * 0.34;
  rig.updatePose({
    awake: true, action: "respond", emotion: "curiosity", arousal: 0.7, energy: 0.86,
    cognitiveLoad: 0.25, gazeX: 0.12, gazeY: -0.08, headTilt: 0.04, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0, bodyChannels: step.channels,
    particles: step.state.particles, deltaSeconds: 1 / 30, timeSeconds: step.state.elapsedMs / 1000,
  });

  assert.equal(rig.root.userData.poseState.particleBindingsApplied, 9);
  assert.ok(Math.abs(rig.bones.chest.position.z) > 0 || Math.abs(rig.bones.chest.position.x) > 0);
  assert.notEqual(rig.bones.leftUpperArm.rotation.z, 0);
  assert.notEqual(rig.bones.rightUpperArm.rotation.z, 0);
  assert.notEqual(rig.bones.leftIndex2.rotation.z, 0);
  assert.notEqual(rig.root.rotation.y, 0);
  for (const [name, bone] of Object.entries(rig.bones)) {
    const limits = rig.limits[name];
    for (const axis of ["x", "y", "z"]) {
      assert.ok(bone.rotation[axis] >= limits[axis][0] - 1e-7, `${name}.${axis} below joint limit`);
      assert.ok(bone.rotation[axis] <= limits[axis][1] + 1e-7, `${name}.${axis} above joint limit`);
    }
  }

  rig.dispose();
});

test("neutral procedural skeleton matches 18 joint landmarks and retains four foot-support particles", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const state = createAvatarArticulatedBodyState();

  rig.updatePose({
    awake: true, action: "rest", emotion: "calm", arousal: 0.2, energy: 0.7,
    cognitiveLoad: 0.1, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0, particles: state.particles,
    deltaSeconds: 0.1, timeSeconds: 0,
  });

  const bindings = [
    ["pelvis", "pelvis"],
    ["chest", "chest"],
    ["neck", "neck"],
    ["head", "head"],
    ["leftShoulderPoint", "leftUpperArm"],
    ["leftElbowPoint", "leftForearm"],
    ["leftWristPoint", "leftWrist"],
    ["leftHandPoint", "leftHand"],
    ["rightShoulderPoint", "rightUpperArm"],
    ["rightElbowPoint", "rightForearm"],
    ["rightWristPoint", "rightWrist"],
    ["rightHandPoint", "rightHand"],
    ["leftHipPoint", "leftHip"],
    ["leftKneePoint", "leftKnee"],
    ["leftAnklePoint", "leftAnkle"],
    ["rightHipPoint", "rightHip"],
    ["rightKneePoint", "rightKnee"],
    ["rightAnklePoint", "rightAnkle"],
  ];

  assert.equal(bindings.length, 18, "18 particles are direct skeleton landmarks or IK endpoints");
  assert.equal(Object.keys(state.particles).length, AVATAR_ARTICULATED_BODY_PARTICLE_COUNT);
  for (const [particleId, boneName] of bindings) {
    const particle = state.particles[particleId];
    const expected = rig.root.localToWorld(new THREE.Vector3(
      particle.position.x,
      1 + particle.position.y,
      particle.position.z,
    ));
    const actual = rig.bones[boneName].getWorldPosition(new THREE.Vector3());
    const error = actual.distanceTo(expected);
    assert.ok(error < 5e-4, `${particleId} → ${boneName} rest-pose error was ${error.toFixed(6)} m`);
  }

  // Heel/toe particles are ground-contact support points, not extra skeleton pivots.
  // They must remain in the solver graph and connect to each ankle independently.
  const supportPairs = [
    ["leftAnklePoint", "leftHeelPoint"],
    ["leftHeelPoint", "leftToePoint"],
    ["rightAnklePoint", "rightHeelPoint"],
    ["rightHeelPoint", "rightToePoint"],
  ];
  for (const [from, to] of supportPairs) {
    assert.ok(state.segments.some((segment) => segment.from === from && segment.to === to),
      `missing foot support constraint: ${from} -> ${to}`);
    for (const id of [from, to]) {
      const particle = state.particles[id];
      assert.ok(Number.isFinite(particle.position.x) && Number.isFinite(particle.position.y) && Number.isFinite(particle.position.z),
        `invalid foot support particle: ${id}`);
    }
  }

  rig.dispose();
});

test("solved particle displacements reach the articulated spine, elbow and knee bones", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const particles = {
    chest: { position: { x: 0.025, y: 0.54, z: 0.04 }, target: { x: 0, y: 0.5, z: 0 } },
    leftShoulderPoint: { position: { x: -0.25, y: 0.48, z: 0.02 }, target: { x: -0.22, y: 0.48, z: 0 } },
    rightHipPoint: { position: { x: 0.13, y: -0.04, z: 0.02 }, target: { x: 0.12, y: -0.04, z: 0 } },
  };

  rig.updatePose({
    awake: true, action: "inspect", emotion: "curiosity", arousal: 0.5, energy: 0.7,
    cognitiveLoad: 0.2, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0, particles, deltaSeconds: 1 / 60,
  });

  assert.ok(rig.bones.chest.position.x > 0);
  assert.ok(rig.bones.chest.position.y > 0.22);
  assert.ok(rig.bones.chest.position.z > 0);
  assert.ok(rig.bones.leftUpperArm.position.x < -0.08);
  assert.ok(rig.bones.rightHip.position.x > 0.12);
  assert.equal(rig.root.userData.poseState.particleBindingsApplied, 3);

  rig.dispose();
});

test("mirrored arm IK places both wrist bones exactly on their world-space targets", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  rig.root.updateMatrixWorld(true);

  for (const side of ["left", "right"] as const) {
    const shoulder = rig.bones[side + "UpperArm"].getWorldPosition(new THREE.Vector3());
    const direction = side === "left" ? -1 : 1;
    const target = shoulder.clone().add(new THREE.Vector3(direction * 0.35, -0.45, 0));
    const solved = rig.solveArmTarget(side, target, 1);
    rig.root.updateMatrixWorld(true);
    const wrist = rig.bones[side + "Wrist"].getWorldPosition(new THREE.Vector3());
    const error = wrist.distanceTo(target);

    assert.equal(solved.reachable, true);
    assert.ok(error < 1e-4, `${side} arm IK endpoint error was ${error}`);
    assert.ok(rig.bones[side + "Forearm"].rotation.z >= rig.limits[side + "Forearm"].z[0]);
    assert.ok(rig.bones[side + "Forearm"].rotation.z <= rig.limits[side + "Forearm"].z[1]);
  }

  rig.dispose();
});

test("left and right leg IK place the ankle bones on particle-derived world targets", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  rig.root.updateMatrixWorld(true);

  for (const side of ["left", "right"] as const) {
    const hip = rig.bones[side + "Hip"].getWorldPosition(new THREE.Vector3());
    const target = hip.clone().add(new THREE.Vector3(0, -0.8, 0));
    const solved = rig.solveLegTarget(side, target, 1);
    rig.root.updateMatrixWorld(true);
    const ankle = rig.bones[side + "Ankle"].getWorldPosition(new THREE.Vector3());
    const error = ankle.distanceTo(target);

    assert.equal(solved.reachable, true);
    assert.ok(error < 1e-4, `${side} leg IK endpoint error was ${error}`);
    assert.ok(rig.bones[side + "Hip"].rotation.z >= rig.limits[side + "Hip"].z[0]);
    assert.ok(rig.bones[side + "Hip"].rotation.z <= rig.limits[side + "Hip"].z[1]);
    assert.ok(rig.bones[side + "Knee"].rotation.z >= rig.limits[side + "Knee"].z[0]);
    assert.ok(rig.bones[side + "Knee"].rotation.z <= rig.limits[side + "Knee"].z[1]);
  }

  rig.dispose();
});

test("finger motors curl both hands toward the palm", () => {
  const scene = new THREE.Scene();
  const rig = createProceduralHumanoidRig(scene);
  const leftTipBefore = rig.bones.leftIndex3.getWorldPosition(new THREE.Vector3());
  const rightTipBefore = rig.bones.rightIndex3.getWorldPosition(new THREE.Vector3());

  rig.updatePose({
    awake: true, action: "inspect", emotion: "focus", arousal: 0.4, energy: 0.7,
    cognitiveLoad: 0.2, gazeX: 0, gazeY: 0, headTilt: 0, speaking: false,
    leftArmIntent: 0, rightArmIntent: 0,
    bodyChannels: { leftIndexCurl: 1, rightIndexCurl: 1 },
    deltaSeconds: 0.1,
  });
  rig.root.updateMatrixWorld(true);

  const leftTipAfter = rig.bones.leftIndex3.getWorldPosition(new THREE.Vector3());
  const rightTipAfter = rig.bones.rightIndex3.getWorldPosition(new THREE.Vector3());
  assert.ok(rig.bones.leftIndex1.rotation.z > 0);
  assert.ok(rig.bones.rightIndex1.rotation.z < 0);
  assert.ok(leftTipAfter.y < leftTipBefore.y);
  assert.ok(rightTipAfter.y < rightTipBefore.y);

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
