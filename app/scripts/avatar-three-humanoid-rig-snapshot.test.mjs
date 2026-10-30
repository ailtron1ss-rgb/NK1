import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { captureHumanoidRigSnapshot } from "../src/components/avatar/threeHumanoidRigSnapshot.ts";

const close = (actual, expected, epsilon = 1e-8) =>
  actual.every((value, index) => Math.abs(value - expected[index]) < epsilon);

function makeRig({ rootRotation = 0, rootOffset = 0 } = {}) {
  const frame = new THREE.Group();
  const root = new THREE.Group();
  root.position.x = rootOffset;
  root.rotation.z = rootRotation;
  frame.add(root);

  const hips = new THREE.Bone();
  hips.name = "hips";
  hips.position.y = 0.5;
  const spine = new THREE.Bone();
  spine.name = "spine";
  spine.position.y = 0.7;
  const head = new THREE.Bone();
  head.name = "head";
  head.position.y = 0.4;
  root.add(hips);
  hips.add(spine);
  spine.add(head);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.2), new THREE.MeshBasicMaterial());
  mesh.position.y = 0.8;
  root.add(mesh);

  return { frame, root, bones: [
    { node: hips, name: "hips" },
    { node: spine, name: "spine" },
    { node: head, name: "head" },
  ] };
}

test("captures semantic local and frame-relative world rest rotations", () => {
  const rig = makeRig({ rootRotation: Math.PI / 2 });
  const snapshot = captureHumanoidRigSnapshot(rig.root, rig.bones, rig.frame);

  assert.deepEqual([...snapshot.roleToNode.keys()], ["hips", "spine", "head"]);
  assert.deepEqual(snapshot.roleToNode.get("head"), 2);
  assert.ok(close(snapshot.restLocalRotation.get("hips"), [0, 0, 0, 1]));
  // Root rotation is preserved in the shared external frame for source/target calibration.
  assert.ok(close(snapshot.restWorldRotation.get("hips"), [0, 0, Math.SQRT1_2, Math.SQRT1_2]));
  assert.ok(snapshot.height > 1.5 && snapshot.height < 1.7);
  assert.equal(snapshot.boneLength.get("hips"), 0.7);
});

test("two differently placed rig roots produce rotations in the same external frame", () => {
  const frame = new THREE.Group();
  const source = makeRig({ rootRotation: Math.PI / 2, rootOffset: -2 });
  const target = makeRig({ rootRotation: 0, rootOffset: 3 });
  frame.add(source.root);
  frame.add(target.root);
  const sourceSnapshot = captureHumanoidRigSnapshot(source.root, source.bones, frame);
  const targetSnapshot = captureHumanoidRigSnapshot(target.root, target.bones, frame);

  assert.ok(close(sourceSnapshot.restWorldRotation.get("spine"), [0, 0, Math.SQRT1_2, Math.SQRT1_2]));
  assert.ok(close(targetSnapshot.restWorldRotation.get("spine"), [0, 0, 0, 1]));
});

test("ignores duplicate semantic roles and duplicate node references deterministically", () => {
  const rig = makeRig();
  const snapshot = captureHumanoidRigSnapshot(rig.root, [
    ...rig.bones,
    { node: rig.bones[0].node, name: "hipsDuplicate" },
    { node: rig.bones[1].node, name: "spine" },
  ], rig.frame);

  assert.equal(snapshot.roleToNode.size, 3);
  assert.equal(snapshot.roleToNode.has("hipsDuplicate"), false);
});

test("rig-local height is invariant to world yaw and scales with the avatar root", () => {
  const unscaled = makeRig({ rootRotation: Math.PI / 2 });
  const scaled = makeRig({ rootRotation: Math.PI / 2 });
  scaled.root.scale.setScalar(2);
  const unscaledSnapshot = captureHumanoidRigSnapshot(unscaled.root, unscaled.bones, unscaled.frame);
  const scaledSnapshot = captureHumanoidRigSnapshot(scaled.root, scaled.bones, scaled.frame);
  assert.ok(Math.abs(scaledSnapshot.height - unscaledSnapshot.height * 2) < 1e-8);
  assert.ok(Math.abs(scaledSnapshot.boneLength.get("hips") - unscaledSnapshot.boneLength.get("hips") * 2) < 1e-8);
});
