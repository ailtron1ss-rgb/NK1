import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { resolveDepthRigPose } from "../src/components/avatar/depthRig.ts";
import {
  applyDepthRigPreparedScenePoseV1,
  prepareDepthRigSceneV1,
  validateDepthRigSceneAssetV1,
} from "../src/components/avatar/depthRigSceneAdapter.ts";

const rest = { x: 0, y: 0, z: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const node = (id, role, parentId, depthOrder, restValue = rest, pivot = { x: 0.5, y: 0.5 }) => ({
  id, role, parentId, depthOrder, pivot, rest: { ...restValue },
});
const asset = () => ({
  schemaVersion: 1,
  rig: {
    version: 1,
    id: "nk1-kurisu-2p5d-test",
    coordinateSystem: "normalized-y-down",
    nodes: [
      node("root", "root", null, 0),
      node("torso", "torso", "root", 2, { ...rest, y: 0.12 }),
      node("head", "head", "torso", 3, { ...rest, x: 0.02, y: -0.18, rotation: 4 }, { x: 0.5, y: 0.8 }),
      node("hair-front", "hair-front", "head", 4),
    ],
  },
  artwork: { width: 2, height: 3, units: "scene", origin: "center" },
  layers: [
    { nodeId: "root", objectName: "RigRoot", width: 2, height: 3 },
    { nodeId: "torso", objectName: "Torso", width: 1.2, height: 1.5 },
    { nodeId: "head", objectName: "Head", width: 0.7, height: 0.8 },
    { nodeId: "hair-front", objectName: "HairFront", width: 0.75, height: 0.6 },
  ],
});

function sceneFor() {
  const root = new THREE.Group();
  root.name = "GLTFScene";
  const rigRoot = new THREE.Group();
  rigRoot.name = "RigRoot";
  root.add(rigRoot);
  const torso = new THREE.Group();
  torso.name = "Torso";
  rigRoot.add(torso);
  const head = new THREE.Group();
  head.name = "Head";
  torso.add(head);
  const hair = new THREE.Group();
  hair.name = "HairFront";
  head.add(hair);
  return { root, rigRoot, torso, head, hair };
}

test("validates a versioned asset with exact layer bindings and explicit scene units", () => {
  assert.deepEqual(validateDepthRigSceneAssetV1(asset()), { ok: true, errors: [] });
});

test("accepts a child-before-parent layer manifest without relying on input array order", () => {
  const source = asset();
  source.layers.reverse();
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, source);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.prepared.bindings.size, 4);
});

test("rejects inherited metadata, unsupported units and missing or duplicate layer bindings", () => {
  const inherited = Object.assign(Object.create({ schemaVersion: 1 }), {
    rig: asset().rig, artwork: asset().artwork, layers: asset().layers,
  });
  assert.ok(validateDepthRigSceneAssetV1(inherited).errors.includes("asset-not-plain-record"));

  const wrongUnits = asset();
  wrongUnits.artwork.units = "guess";
  assert.ok(validateDepthRigSceneAssetV1(wrongUnits).errors.includes("unsupported-artwork-units"));

  const missing = asset();
  missing.layers.pop();
  assert.ok(validateDepthRigSceneAssetV1(missing).errors.includes("missing-layer-binding:hair-front"));

  const duplicate = asset();
  duplicate.layers[3].objectName = "Head";
  assert.ok(validateDepthRigSceneAssetV1(duplicate).errors.includes("duplicate-layer-object-name:Head"));
});

test("requires exact scene object names and the authored parent hierarchy", () => {
  const wrongParent = sceneFor();
  wrongParent.torso.parent.remove(wrongParent.torso);
  wrongParent.root.add(wrongParent.torso);
  const result = prepareDepthRigSceneV1(wrongParent.root, asset());
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("scene-parent-mismatch:torso"));

  const missing = sceneFor();
  missing.head.name = "HeadRenamed";
  const missingResult = prepareDepthRigSceneV1(missing.root, asset());
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.errors.includes("missing-scene-object:Head"));
});

test("applies rest pose plus bounded semantic deltas to real Three.js nodes with pivot compensation", () => {
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, asset());
  assert.equal(prepared.ok, true);
  const pose = resolveDepthRigPose(asset().rig, {
    headYaw: 0.5, headPitch: 0.25, headRoll: 0.3,
    torsoYaw: 0.2, torsoLean: 0.1, breath: 0.5,
    gesture: "explain-right", gestureIntensity: 0.7,
  });
  const result = applyDepthRigPreparedScenePoseV1(prepared.prepared, pose, {
    stateRevision: 37, executionId: "scene-apply-37-1",
  });
  assert.equal(result.status, "applied");
  assert.equal(result.receipt.verified, true);
  assert.equal(result.receipt.presentedFrameVerified, false);
  assert.equal(result.receipt.stateRevision, 37);
  assert.equal(result.receipt.executionId, "scene-apply-37-1");
  assert.deepEqual(result.receipt.appliedNodeIds.sort(), ["hair-front", "head", "root", "torso"]);
  assert.equal(scene.head.rotation.z, -(4 + pose.deltas.head.rotation) * Math.PI / 180);
  assert.ok(Math.abs(scene.head.position.x) < 1);
  assert.equal(scene.hair.renderOrder, 4);
});

test("rejects stale or malformed application context and foreign rig poses before mutation", () => {
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, asset()).prepared;
  const before = scene.head.position.clone();
  assert.equal(applyDepthRigPreparedScenePoseV1(prepared, null, { stateRevision: -1, executionId: "bad" }).status, "rejected");
  assert.equal(applyDepthRigPreparedScenePoseV1(prepared, null, { stateRevision: 1, executionId: "" }).status, "rejected");
  assert.equal(applyDepthRigPreparedScenePoseV1(prepared, { rigId: "foreign", deltas: {} }, { stateRevision: 1, executionId: "x" }).status, "rejected");
  const inheritedPose = Object.assign(Object.create({ rigId: asset().rig.id, deltas: {} }), {});
  assert.equal(applyDepthRigPreparedScenePoseV1(prepared, inheritedPose, { stateRevision: 1, executionId: "x" }).status, "rejected");
  assert.ok(scene.head.position.distanceTo(before) === 0);
});

test("rolls every layer back when one renderer node fails during apply", () => {
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, asset()).prepared;
  const rootBefore = scene.rigRoot.position.clone();
  const headBefore = scene.head.position.clone();
  const original = scene.head.position.set.bind(scene.head.position);
  let failOnce = true;
  scene.head.position.set = (x, y, z) => {
    if (failOnce && Math.abs(x) > 0.01) {
      failOnce = false;
      throw new Error("injected-head-apply-failure");
    }
    return original(x, y, z);
  };
  const result = applyDepthRigPreparedScenePoseV1(prepared, resolveDepthRigPose(asset().rig, {
    headYaw: 0.9, headPitch: 0.7, headRoll: 0.8,
    torsoYaw: 0.6, torsoLean: 0.5, breath: 0.4,
    gesture: "cross-arms", gestureIntensity: 1,
  }), { stateRevision: 9, executionId: "rollback-1" });
  assert.equal(result.status, "rolled-back");
  assert.match(result.errors[0], /injected-head-apply-failure/);
  assert.deepEqual(scene.rigRoot.position.toArray(), rootBefore.toArray());
  assert.deepEqual(scene.head.position.toArray(), headBefore.toArray());
});

test("rolls back on readback mismatch rather than issuing an apply receipt", () => {
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, asset()).prepared;
  const original = scene.head.rotation.set.bind(scene.head.rotation);
  let corruptOnce = true;
  scene.head.rotation.set = (x, y, z) => {
    if (corruptOnce) { corruptOnce = false; return original(x, y, z + 0.05); }
    return original(x, y, z);
  };
  const result = applyDepthRigPreparedScenePoseV1(prepared, null, {
    stateRevision: 2, executionId: "readback-mismatch",
  });
  assert.equal(result.status, "rolled-back");
  assert.ok(result.errors.some((error) => error.includes("postcondition-mismatch:head")));
  assert.equal(scene.head.rotation.z, 0);
});

test("rejects hierarchy changes after preparation and emits no apply receipt", () => {
  const scene = sceneFor();
  const prepared = prepareDepthRigSceneV1(scene.root, asset()).prepared;
  scene.head.parent.remove(scene.head);
  scene.root.add(scene.head);
  const result = applyDepthRigPreparedScenePoseV1(prepared, null, {
    stateRevision: 3, executionId: "changed-scene",
  });
  assert.equal(result.status, "rolled-back");
  assert.ok(result.errors.includes("scene-hierarchy-changed:head"));
  assert.equal(result.receipt, undefined);
});

console.log("NK1 canonical 2.5D scene adapter contract: PASS");
