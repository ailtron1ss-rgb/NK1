import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { VRMHumanoid } from "@pixiv/three-vrm";
import {
  applyVrmFullBodyChannels,
  applyVrmNormalizedMotorFrame,
  configureVrmForNk1NormalizedMotorDrive,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";

function createSyntheticHumanoid(metaVersion = "1") {
  const root = new THREE.Object3D();
  const nodes = {};
  const add = (name, parent) => {
    const node = new THREE.Object3D();
    node.name = name;
    parent.add(node);
    nodes[name] = { node };
    return node;
  };

  const hips = add("hips", root);
  const spine = add("spine", hips);
  const chest = add("chest", spine);
  const upperChest = add("upperChest", chest);
  const neck = add("neck", upperChest);
  const head = add("head", neck);

  for (const side of ["left", "right"]) {
    const upperLeg = add(`${side}UpperLeg`, hips);
    const lowerLeg = add(`${side}LowerLeg`, upperLeg);
    add(`${side}Foot`, lowerLeg);

    const shoulder = add(`${side}Shoulder`, upperChest);
    const upperArm = add(`${side}UpperArm`, shoulder);
    const lowerArm = add(`${side}LowerArm`, upperArm);
    const hand = add(`${side}Hand`, lowerArm);
    const addChain = (finger, segments) => {
      let parent = hand;
      for (const segment of segments) parent = add(`${side}${finger}${segment}`, parent);
    };
    addChain("Thumb", metaVersion === "0"
      ? ["Proximal", "Intermediate", "Distal"]
      : ["Metacarpal", "Proximal", "Distal"]);
    for (const finger of ["Index", "Middle", "Ring", "Little"]) {
      addChain(finger, ["Proximal", "Intermediate", "Distal"]);
    }
  }

  root.updateMatrixWorld(true);
  const rawFingerBones = Object.entries(nodes)
    .filter(([name]) => /^(left|right)(Thumb|Index|Middle|Ring|Little)/.test(name))
    .map(([, value]) => value.node);
  return {
    root,
    nodes,
    rawHead: head,
    rawNeck: neck,
    rawHips: hips,
    rawSpine: spine,
    rawLeftFoot: nodes.leftFoot.node,
    rawRightFoot: nodes.rightFoot.node,
    rawLeftArm: nodes.leftUpperArm.node,
    rawRightArm: nodes.rightUpperArm.node,
    rawFingerBones,
  };
}

test("real three-vrm VRMHumanoid transfers NK1 normalized motor output into raw skeleton", () => {
  const fixture = createSyntheticHumanoid();
  const humanoid = new VRMHumanoid(fixture.nodes, { autoUpdateHumanBones: false });
  let resetCount = 0;
  const vrm = {
    humanoid,
    expressionManager: { resetValues() { resetCount += 1; } },
  };

  configureVrmForNk1NormalizedMotorDrive(vrm);
  assert.equal(humanoid.autoUpdateHumanBones, true);
  assert.equal(resetCount, 1);

  const result = applyVrmNormalizedMotorFrame(vrm, {
    action: "explore",
    emotion: "sadness",
    gazeX: 0.4,
    gazeY: -0.2,
    cognitiveLoad: 0.25,
    energy: 0.8,
    socialNeed: 0.1,
    uncertainty: 0.15,
    speaking: false,
  });
  assert.equal(result.applied, true);
  assert.ok(result.controlledBones.includes("head"));
  assert.ok(result.controlledBones.includes("neck"));
  assert.ok(result.controlledBones.includes("leftUpperArm"));

  humanoid.update();
  assert.ok(Math.abs(fixture.rawHead.rotation.x) > 0.001);
  assert.ok(Math.abs(fixture.rawNeck.rotation.x) > 0.001);
  assert.ok(Math.abs(fixture.rawLeftArm.rotation.z) > 0.1);
  assert.ok(Math.abs(fixture.rawRightArm.rotation.z) < 1e-9);

  // A second neutral frame must return raw bones to the model's neutral pose.
  applyVrmNormalizedMotorFrame(vrm, {
    action: "rest",
    emotion: "calm",
    gazeX: 0,
    gazeY: 0,
    cognitiveLoad: 0,
    energy: 1,
    socialNeed: 0,
    uncertainty: 0,
    speaking: false,
  });
  humanoid.update();
  assert.ok(Math.abs(fixture.rawHead.rotation.x) < 1e-9);
  assert.ok(Math.abs(fixture.rawHead.rotation.y) < 1e-9);
  assert.ok(Math.abs(fixture.rawHead.rotation.z) < 1e-9);
  assert.ok(Math.abs(fixture.rawLeftArm.rotation.z) < 1e-9);
});


test("real three-vrm transfers normalized torso/root yaw and ankle output to raw bones", () => {
  const fixture = createSyntheticHumanoid();
  const humanoid = new VRMHumanoid(fixture.nodes, { autoUpdateHumanBones: false });
  const vrm = {
    humanoid,
    expressionManager: { resetValues() {} },
  };

  configureVrmForNk1NormalizedMotorDrive(vrm);
  const driven = applyVrmFullBodyChannels(vrm, {
    torsoPitch: 0.25,
    torsoYaw: 0.5,
    rootYaw: -0.5,
    leftAnkle: 0.5,
    rightAnkle: -0.25,
  });
  assert.deepEqual(driven.controlledBones.sort(), ["hips", "leftFoot", "rightFoot", "spine"]);
  humanoid.update();

  assert.ok(Math.abs(fixture.rawHips.rotation.y + 0.45) < 1e-6);
  assert.ok(Math.abs(fixture.rawSpine.rotation.x - 0.1) < 1e-6);
  assert.ok(Math.abs(fixture.rawSpine.rotation.y - 0.25) < 1e-6);
  assert.ok(Math.abs(fixture.rawLeftFoot.rotation.x - 0.25) < 1e-6);
  assert.ok(Math.abs(fixture.rawRightFoot.rotation.x + 0.125) < 1e-6);

  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  humanoid.update();
  for (const bone of [fixture.rawHips, fixture.rawSpine, fixture.rawLeftFoot, fixture.rawRightFoot]) {
    assert.ok(Math.abs(bone.rotation.x) < 1e-9);
    assert.ok(Math.abs(bone.rotation.y) < 1e-9);
    assert.ok(Math.abs(bone.rotation.z) < 1e-9);
  }
});


for (const metaVersion of ["0", "1"]) {
  test(`real three-vrm transfers ${metaVersion}.x thumb and finger curl into the raw skeleton`, () => {
    const fixture = createSyntheticHumanoid(metaVersion);
    const humanoid = new VRMHumanoid(fixture.nodes, { autoUpdateHumanBones: false });
    const vrm = {
      meta: { metaVersion },
      humanoid,
      expressionManager: { resetValues() {} },
    };

    configureVrmForNk1NormalizedMotorDrive(vrm);
    const driven = applyVrmFullBodyChannels(vrm, { leftFingers: 0.5, rightFingers: -0.5 });
    assert.equal(driven.controlledBones.length, 30);
    if (metaVersion === "0") {
      assert.ok(driven.controlledBones.includes("leftThumbIntermediate"));
      assert.equal(driven.controlledBones.includes("leftThumbMetacarpal"), false);
    } else {
      assert.ok(driven.controlledBones.includes("leftThumbMetacarpal"));
      assert.equal(driven.controlledBones.includes("leftThumbIntermediate"), false);
    }

    humanoid.update();
    const thumbMiddle = metaVersion === "0" ? fixture.nodes.leftThumbIntermediate.node : fixture.nodes.leftThumbProximal.node;
    assert.ok(Math.abs(thumbMiddle.rotation.x) > 0.01);
    assert.ok(Math.abs(fixture.nodes.leftIndexIntermediate.node.rotation.x) > 0.01);
    assert.ok(Math.abs(fixture.nodes.rightLittleDistal.node.rotation.x) > 0.01);
    assert.ok(Math.sign(thumbMiddle.rotation.x) > 0);
    assert.ok(Math.sign(fixture.nodes.rightLittleDistal.node.rotation.x) < 0);

    const neutral = applyVrmFullBodyChannels(vrm, {});
    assert.equal(neutral.applied, false);
    humanoid.update();
    for (const bone of fixture.rawFingerBones) {
      assert.ok(Math.abs(bone.rotation.x) < 1e-9);
      assert.ok(Math.abs(bone.rotation.y) < 1e-9);
      assert.ok(Math.abs(bone.rotation.z) < 1e-9);
    }
  });
}
