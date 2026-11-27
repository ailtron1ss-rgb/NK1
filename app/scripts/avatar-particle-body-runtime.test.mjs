import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createAvatarParticleBodyRuntime,
  resetAvatarParticleBodyPose,
  stepAvatarParticleBodyPose,
} from "../src/components/avatar/avatarParticleBodyRuntime.ts";

function makeHumanoid() {
  const root = new THREE.Group();
  const bones = new Map();
  const add = (id, parent, position) => {
    const bone = new THREE.Bone();
    bone.name = id;
    bone.position.set(...position);
    (parent ?? root).add(bone);
    bones.set(id, bone);
    return bone;
  };
  const hips = add("hips", null, [0, 0.9, 0]);
  const spine = add("spine", hips, [0, 0.3, 0]);
  const chest = add("chest", spine, [0, 0.3, 0]);
  const upperChest = add("upperChest", chest, [0, 0.12, 0]);
  const neck = add("neck", upperChest, [0, 0.1, 0]);
  add("head", neck, [0, 0.2, 0]);

  for (const side of ["left", "right"]) {
    const sign = side === "left" ? -1 : 1;
    const shoulder = add(`${side}Shoulder`, upperChest, [sign * 0.12, 0.05, 0]);
    const upperArm = add(`${side}UpperArm`, shoulder, [sign * 0.15, 0, 0]);
    const lowerArm = add(`${side}LowerArm`, upperArm, [sign * 0.18, 0, 0]);
    add(`${side}Hand`, lowerArm, [sign * 0.16, 0, 0]);
    const upperLeg = add(`${side}UpperLeg`, hips, [sign * 0.12, -0.1, 0]);
    const lowerLeg = add(`${side}LowerLeg`, upperLeg, [0, -0.32, 0]);
    const foot = add(`${side}Foot`, lowerLeg, [0, -0.3, 0.02]);
    add(`${side}Toes`, foot, [0, -0.02, 0.1]);
  }
  root.updateWorldMatrix(true, true);
  return { root, bones, humanoid: { getNormalizedBoneNode: (name) => bones.get(name) ?? null } };
}

test("particle body runtime binds the full articulated humanoid as real bone particles", () => {
  const { root, bones, humanoid } = makeHumanoid();
  const runtime = createAvatarParticleBodyRuntime(root, humanoid);
  assert.ok(runtime);
  assert.equal(runtime.state.nodes.length, 22);
  assert.ok(runtime.state.constraints.length >= 18);
  assert.ok(runtime.bindings.every((binding) => binding.node.isBone));
});

test("particle body runtime writes inertial corrections back into actual Three.js bone transforms", () => {
  const { root, bones, humanoid } = makeHumanoid();
  const runtime = createAvatarParticleBodyRuntime(root, humanoid);
  assert.ok(runtime);
  resetAvatarParticleBodyPose(runtime);
  const originalHeadX = bones.get("head").position.x;
  const originalChestX = bones.get("chest").position.x;
  bones.get("chest").position.x += 0.065;
  root.updateWorldMatrix(true, true);
  const result = stepAvatarParticleBodyPose(runtime, {
    deltaSeconds: 1 / 60,
    awake: true,
    motion01: 0.8,
  });
  assert.ok(result);
  assert.ok(result.simulationSteps > 0);
  assert.ok(Math.abs(bones.get("head").position.x - originalHeadX) > 1e-6,
    "the simulated head particle must visibly alter the real head bone transform");
  assert.ok(Math.abs(bones.get("chest").position.x - (originalChestX + 0.065)) <= 0.012001,
    "particle correction must remain inside the configured chest envelope");
  for (const binding of runtime.bindings) {
    assert.ok([binding.node.position.x, binding.node.position.y, binding.node.position.z].every(Number.isFinite));
  }
});

test("particle pose reset restores the authored local bone positions before each animation frame", () => {
  const { root, bones, humanoid } = makeHumanoid();
  const runtime = createAvatarParticleBodyRuntime(root, humanoid);
  assert.ok(runtime);
  const head = bones.get("head");
  const base = head.position.clone();
  head.position.x += 0.08;
  resetAvatarParticleBodyPose(runtime);
  assert.ok(head.position.distanceTo(base) < 1e-9);
});

test("a partial generic GLB rig is not fabricated into a full particle skeleton", () => {
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = "Hips"; root.add(hips);
  const spine = new THREE.Bone(); spine.name = "Spine"; hips.add(spine);
  const chest = new THREE.Bone(); chest.name = "Chest"; spine.add(chest);
  root.updateWorldMatrix(true, true);
  assert.equal(createAvatarParticleBodyRuntime(root), null);
});
