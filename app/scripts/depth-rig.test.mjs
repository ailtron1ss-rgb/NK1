import test from "node:test";
import assert from "node:assert/strict";
import { orderDepthRigNodes, resolveDepthRigPose, validateDepthRig } from "../src/components/avatar/depthRig.ts";

const transform = { x: 0, y: 0, z: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const node = (id, role, parentId, depthOrder) => ({
  id, role, parentId, depthOrder, pivot: { x: 0.5, y: 0.5 }, rest: { ...transform },
});
const rig = {
  version: 1,
  id: "kurisu-depth-rig-test",
  coordinateSystem: "normalized-y-down",
  nodes: [
    node("root", "root", null, 0),
    node("torso", "torso", "root", 2),
    node("neck", "neck", "torso", 3),
    node("head", "head", "neck", 4),
    node("hair-front", "hair-front", "head", 5),
    node("arm-left", "upper-arm-left", "torso", 1),
  ],
};

test("accepts a single-root rig with valid parent references", () => {
  assert.deepEqual(validateDepthRig(rig), []);
});

test("orders layers by explicit depthOrder, independent of input order", () => {
  assert.deepEqual(orderDepthRigNodes(rig).map((entry) => entry.id), [
    "root", "arm-left", "torso", "neck", "head", "hair-front",
  ]);
});

test("rejects duplicate ids, missing parents and invalid pivots", () => {
  const invalid = {
    ...rig,
    nodes: [
      ...rig.nodes,
      { ...node("head", "head", "missing", 6), pivot: { x: 2, y: 0.5 } },
    ],
  };
  const codes = validateDepthRig(invalid).map((entry) => entry.code);
  assert.ok(codes.includes("duplicate-id"));
  assert.ok(codes.includes("missing-parent"));
  assert.ok(codes.includes("invalid-pivot"));
});

test("detects parent cycles and multiple roots", () => {
  const invalid = {
    ...rig,
    nodes: [
      node("root-a", "root", "root-b", 0),
      node("root-b", "torso", "root-a", 1),
      node("root-c", "root", null, 2),
      node("root-d", "root", null, 3),
    ],
  };
  const codes = validateDepthRig(invalid).map((entry) => entry.code);
  assert.ok(codes.includes("parent-cycle"));
  assert.ok(codes.includes("multiple-roots"));
});

test("maps bounded semantic intent to head, torso, hair and gesture deltas", () => {
  const pose = resolveDepthRigPose(rig, {
    headYaw: 9, headPitch: -0.5, headRoll: 0.25,
    torsoYaw: 0.5, torsoLean: 0.4, breath: 0.6,
    gesture: "explain-left", gestureIntensity: 0.8,
  });
  assert.equal(pose.rigId, rig.id);
  assert.equal(pose.deltas.head.x, 0.018);
  assert.equal(pose.deltas.head.rotation, 1.75);
  assert.equal(pose.deltas["arm-left"].rotation, -25.6);
  assert.ok(Math.abs(pose.deltas.torso.rotation - 2) < 1e-9);
});

test("fails closed instead of rendering malformed artist data", () => {
  assert.throws(() => resolveDepthRigPose({ ...rig, nodes: [] }, {
    headYaw: 0, headPitch: 0, headRoll: 0, torsoYaw: 0, torsoLean: 0,
    breath: 0, gesture: "none", gestureIntensity: 0,
  }), /Invalid depth rig/);
});

test("rejects malformed node objects and missing rest transforms without throwing", () => {
  const invalid = { ...rig, nodes: [null, { ...node("broken", "head", null, 1), rest: undefined }] };
  const diagnostics = validateDepthRig(invalid);
  assert.ok(diagnostics.some((entry) => entry.code === "invalid-id"));
  assert.ok(diagnostics.some((entry) => entry.code === "invalid-number"));
});
