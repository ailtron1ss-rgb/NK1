import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyDepthRigTransforms } from "../src/components/avatar/depthRigThreeAdapter.ts";

const transform = (id, overrides = {}) => ({
  id, pivot: [0, 0], position: [1, 2, 3], rotation: [0, 0, 0],
  scale: [1, 1, 1], visible: true, renderOrder: 1200, ...overrides,
});

test("applies named transforms, visibility, render order and pivot compensation", () => {
  const root = new THREE.Group();
  const head = new THREE.Group();
  head.name = "head";
  root.add(head);
  const result = applyDepthRigTransforms(root, [
    transform("head", { pivot: [0.5, 0], scale: [2, 1, 1] }),
  ]);
  assert.deepEqual(result, { ok: true, applied: 1, errors: [] });
  assert.deepEqual(head.position.toArray(), [0.5, 2, 3]);
  assert.deepEqual(head.scale.toArray(), [2, 1, 1]);
  assert.equal(head.visible, true);
  assert.equal(head.renderOrder, 1200);
});

test("rolls back the whole rig when a local transform fails readback", () => {
  const root = new THREE.Group();
  const head = new THREE.Group();
  head.name = "head";
  root.add(head);
  const beforePosition = head.position.toArray();
  const beforeRotation = [head.rotation.x, head.rotation.y, head.rotation.z];
  const originalUpdateMatrix = head.updateMatrix.bind(head);
  let injected = false;
  head.updateMatrix = function () {
    if (!injected) {
      injected = true;
      this.position.x += 100;
    }
    return originalUpdateMatrix();
  };
  const result = applyDepthRigTransforms(root, [
    transform("head", { position: [2, 3, 4], rotation: [0.1, -0.2, 0.3] }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.applied, 0);
  assert.deepEqual(result.errors, ["postcondition-mismatch:head"]);
  assert.deepEqual(head.position.toArray(), beforePosition);
  assert.deepEqual([head.rotation.x, head.rotation.y, head.rotation.z], beforeRotation);
});

test("fails closed on missing or ambiguous scene node names", () => {
  const root = new THREE.Group();
  const a = new THREE.Group(); a.name = "head";
  const b = new THREE.Group(); b.name = "head";
  root.add(a, b);
  const before = a.position.toArray();
  const result = applyDepthRigTransforms(root, [transform("head")]);
  assert.equal(result.ok, false);
  assert.equal(result.applied, 0);
  assert.ok(result.errors.includes("duplicate-scene-node:head"));
  assert.deepEqual(a.position.toArray(), before);
});

test("reports missing imported nodes without partially mutating the scene", () => {
  const root = new THREE.Group();
  const head = new THREE.Group(); head.name = "head";
  root.add(head);
  const result = applyDepthRigTransforms(root, [transform("head"), transform("eyes")]);
  assert.equal(result.ok, false);
  assert.equal(result.applied, 0);
  assert.ok(result.errors.includes("missing-scene-node:eyes"));
  assert.deepEqual(head.position.toArray(), [0, 0, 0]);
});


test("ignores duplicate names that are outside the manifest contract", () => {
  const root = new THREE.Group();
  const a = new THREE.Group(); a.name = "head";
  const unrelatedA = new THREE.Group(); unrelatedA.name = "mesh";
  const unrelatedB = new THREE.Group(); unrelatedB.name = "mesh";
  root.add(a, unrelatedA, unrelatedB);
  const result = applyDepthRigTransforms(root, [transform("head")]);
  assert.equal(result.ok, true);
  assert.equal(result.applied, 1);
});

test("rejects an imported hierarchy that disagrees with manifest parent IDs before mutation", () => {
  const root = new THREE.Group();
  const expectedParent = new THREE.Group(); expectedParent.name = "expected";
  const wrongParent = new THREE.Group(); wrongParent.name = "wrong";
  const head = new THREE.Group(); head.name = "head";
  root.add(expectedParent, wrongParent);
  wrongParent.add(head);
  const before = head.position.toArray();
  const result = applyDepthRigTransforms(root, [transform("head")], [
    { id: "head", parentId: "expected" },
  ]);
  assert.deepEqual(result, { ok: false, applied: 0, errors: ["parent-mismatch:head"] });
  assert.deepEqual(head.position.toArray(), before);
});
