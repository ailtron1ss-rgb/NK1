import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { VRMHumanoid } from "@pixiv/three-vrm";
import {
  applyVrmNormalizedMotorFrame,
  configureVrmForNk1NormalizedMotorDrive,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";

function createSyntheticHumanoid() {
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
    add(`${side}Hand`, lowerArm);
  }

  root.updateMatrixWorld(true);
  return { root, nodes, rawHead: head, rawNeck: neck, rawLeftArm: nodes.leftUpperArm.node, rawRightArm: nodes.rightUpperArm.node };
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
  assert.equal(fixture.rawRightArm.rotation.z, 0);

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
