import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { captureHumanoidRigSnapshot } from "../src/components/avatar/threeHumanoidRigSnapshot.ts";
import { retargetThreeHumanoidClip } from "../src/components/avatar/threeHumanoidClipRetarget.ts";

function rig({ rootRotation = 0, length = 1, scale = 1 } = {}) {
  const frame = new THREE.Group();
  const root = new THREE.Group();
  root.rotation.z = rootRotation;
  root.scale.setScalar(scale);
  frame.add(root);
  const hips = new THREE.Bone();
  hips.name = "hips";
  hips.position.y = 0.2;
  const spine = new THREE.Bone();
  spine.name = "spine";
  spine.position.y = length;
  const head = new THREE.Bone();
  head.name = "head";
  head.position.y = length * 0.5;
  root.add(hips);
  hips.add(spine);
  spine.add(head);
  return { frame, root, bones: [
    { node: hips, name: "hips" },
    { node: spine, name: "spine" },
    { node: head, name: "head" },
  ] };
}

test("bakes an embedded GLTF clip into target-local tracks across differently oriented rigs", () => {
  const frame = new THREE.Group();
  const source = rig({ rootRotation: Math.PI / 2, length: 0.7 });
  const target = rig({ rootRotation: 0, length: 1.1, scale: 1.2 });
  frame.add(source.root);
  frame.add(target.root);
  const sourceRest = captureHumanoidRigSnapshot(source.root, source.bones, frame);
  const targetRest = captureHumanoidRigSnapshot(target.root, target.bones, frame);
  const sourceHead = source.bones.find((bone) => bone.name === "head").node;
  const sourceTrack = new THREE.QuaternionKeyframeTrack(
    `${sourceHead.uuid}.quaternion`,
    [0, 1],
    [0, 0, 0, 1, 0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
  );
  const clip = new THREE.AnimationClip("source-turn", 1, [sourceTrack]);
  const result = retargetThreeHumanoidClip(
    source.root, source.bones, sourceRest,
    target.root, target.bones, targetRest, clip,
    { sampleRate: 10 },
  );

  assert.equal(result.sampledFrames, 11);
  assert.ok(result.transferredRoles.includes("head"));
  assert.ok(result.clip.tracks.some((track) => track.name === `${target.bones[2].node.uuid}.quaternion`));
  const mixer = new THREE.AnimationMixer(target.root);
  const action = mixer.clipAction(result.clip).play();
  mixer.setTime(1);
  assert.ok(Math.abs(target.bones[2].node.quaternion.length() - 1) < 1e-5);
  action.stop();
});

test("fails closed when no paired calibrated humanoid role exists", () => {
  const source = rig();
  const target = rig();
  const sourceRest = captureHumanoidRigSnapshot(source.root, source.bones, source.frame);
  const targetRest = captureHumanoidRigSnapshot(target.root, target.bones, target.frame);
  const clip = new THREE.AnimationClip("empty", 1, []);
  const noWorld = { ...sourceRest, restWorldRotation: undefined };
  assert.throws(
    () => retargetThreeHumanoidClip(source.root, source.bones, noWorld, target.root, target.bones, targetRest, clip),
    /No shared humanoid roles/,
  );
});

test("rejects zero-duration source clips", () => {
  const source = rig();
  const target = rig();
  const sourceRest = captureHumanoidRigSnapshot(source.root, source.bones, source.frame);
  const targetRest = captureHumanoidRigSnapshot(target.root, target.bones, target.frame);
  assert.throws(
    () => retargetThreeHumanoidClip(source.root, source.bones, sourceRest, target.root, target.bones, targetRest, new THREE.AnimationClip("zero", 0, [])),
    /non-empty animation clip/,
  );
});
