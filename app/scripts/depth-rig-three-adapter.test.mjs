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
