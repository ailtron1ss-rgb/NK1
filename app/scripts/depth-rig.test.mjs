import test from "node:test";
import assert from "node:assert/strict";
import { orderDepthRigNodes, resolveDepthRigPose, resolveDepthRigWorldPose, validateDepthRig } from "../src/components/avatar/depthRig.ts";
import { resolveDepthRigPoseFromEmbodimentIntent, resolveDepthRigPoseFromMotorFrame } from "../src/components/avatar/embodimentIntentAdapter.ts";

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


test("composes child transforms through rotated and scaled parent hierarchy", () => {
  const composedRig = {
    ...rig,
    nodes: [
      { ...node("root", "root", null, 0), rest: { ...transform, x: 0.1, y: 0.2, rotation: 90, scaleX: 2, scaleY: 2 } },
      { ...node("torso", "torso", "root", 1), rest: { ...transform, x: 0.5, y: 0, rotation: 0 } },
      { ...node("head", "head", "torso", 2), rest: { ...transform, x: 0, y: 0.25, rotation: 10 } },
    ],
  };
  const world = resolveDepthRigWorldPose(composedRig).transforms;
  assert.ok(Math.abs(world.torso.tx - 0.1) < 1e-9);
  assert.ok(Math.abs(world.torso.ty - 1.2) < 1e-9);
  assert.ok(Math.abs(world.head.tx + 0.4) < 1e-9);
  assert.ok(Math.abs(world.head.ty - 1.2) < 1e-9);
  assert.equal(world.head.rotation, 100);
  assert.equal(world.head.z, 0);
});

test("applies additive pose deltas over rest transforms and accumulates depth", () => {
  const pose = resolveDepthRigPose(rig, {
    headYaw: 0, headPitch: 0, headRoll: 1, torsoYaw: 0.5, torsoLean: 0.2,
    breath: 0, gesture: "none", gestureIntensity: 0,
  });
  const world = resolveDepthRigWorldPose(rig, pose);
  assert.equal(world.transforms.head.rotation, 11.2);
  assert.equal(world.transforms.torso.rotation, 2);
  assert.ok(Math.abs(world.transforms["hair-front"].rotation - 9.4) < 1e-12);
});

test("rejects a pose produced for a different rig and never emits non-finite matrices", () => {
  assert.throws(() => resolveDepthRigWorldPose(rig, { rigId: "other", deltas: {} }), /another rig/);
  const invalid = {
    ...rig,
    nodes: rig.nodes.map((entry) => entry.id === "head"
      ? { ...entry, rest: { ...transform, scaleX: Number.MAX_VALUE, scaleY: Number.MAX_VALUE } }
      : entry),
  };
  assert.throws(() => resolveDepthRigWorldPose(invalid, {
    rigId: rig.id, deltas: { head: { scaleX: Number.MAX_VALUE, scaleY: Number.MAX_VALUE } },
  }), /Non-finite world transform/);
});


test("accumulates local z offsets independently from painter depth order", () => {
  const depthRig = {
    ...rig,
    nodes: [
      { ...node("root", "root", null, 10), rest: { ...transform, z: 0.1 } },
      { ...node("torso", "torso", "root", 0), rest: { ...transform, z: 0.2 } },
      { ...node("head", "head", "torso", 5), rest: { ...transform, z: -0.05 } },
    ],
  };
  const world = resolveDepthRigWorldPose(depthRig).transforms;
  assert.ok(Math.abs(world.head.z - 0.25) < 1e-12);
  assert.deepEqual(orderDepthRigNodes(depthRig).map((entry) => entry.id), ["torso", "head", "root"]);
});

test("adapts the canonical EmbodimentIntent v1 body without introducing another intent owner", () => {
  const pose = resolveDepthRigPoseFromEmbodimentIntent(rig, {
    type: "kurisu_embodiment_intent", protocolVersion: 1, expressionIntensity: 0.75,
    gaze: { x: 0.4, y: -0.2, driven: true },
    body: { headTilt: 0.075, gesture: true, motionGroup: "TapBody", motionIndex: 0 },
  });
  assert.equal(pose.rigId, rig.id);
  assert.equal(pose.deltas.head.x, 0.0072);
  assert.ok(Math.abs(pose.deltas.head.y + 0.0024) < 1e-12);
  assert.equal(pose.deltas.head.rotation, 3.5);
  assert.equal(pose.deltas["arm-left"].rotation, -24);
});

test("rejects malformed EmbodimentIntent v1 adapter payloads", () => {
  assert.throws(() => resolveDepthRigPoseFromEmbodimentIntent(rig, {
    type: "kurisu_embodiment_intent", protocolVersion: 2, expressionIntensity: 1,
    gaze: { x: 0, y: 0, driven: true },
    body: { headTilt: 0, gesture: false, motionGroup: "Idle", motionIndex: 0 },
  }), /Invalid EmbodimentIntent/);
});

test("maps active motor joint targets through explicit bounded rig bindings", () => {
  const pose = resolveDepthRigPoseFromMotorFrame(rig, {
    version: 1, goalId: "goal.explain.01", phase: "moving",
    joints: {
      headYaw: { id: "headYaw", angleRad: 0.1, targetAngleRad: 0.5, velocityRadPerSec: 0.2, available: true },
      leftShoulder: { id: "leftShoulder", angleRad: 0, targetAngleRad: 2, velocityRadPerSec: 0, available: true },
    },
  }, [
    { nodeId: "head", jointId: "headYaw", restAngleRad: 0.1 },
    { nodeId: "arm-left", jointId: "leftShoulder", maxAbsDegrees: 30 },
  ]);
  assert.ok(Math.abs(pose.deltas.head.rotation - (0.4 * 180 / Math.PI)) < 1e-12);
  assert.equal(pose.deltas["arm-left"].rotation, 30);
});

test("idle motor frames do not animate and duplicate or unsafe bindings fail closed", () => {
  const idle = resolveDepthRigPoseFromMotorFrame(rig, {
    version: 1, goalId: null, phase: "idle", joints: {},
  }, [{ nodeId: "head", jointId: "head" }]);
  assert.deepEqual(idle.deltas, {});
  const frame = { version: 1, goalId: "g", phase: "moving", joints: {} };
  assert.throws(() => resolveDepthRigPoseFromMotorFrame(rig, frame, [
    { nodeId: "head", jointId: "a" }, { nodeId: "head", jointId: "b" },
  ]), /binding/);
  assert.throws(() => resolveDepthRigPoseFromMotorFrame(rig, frame, [
    { nodeId: "head", jointId: "a", maxAbsDegrees: 100 },
  ]), /calibration/);
});

test("validates calibration even when a bound motor joint is absent", () => {
  assert.throws(() => resolveDepthRigPoseFromMotorFrame(rig, {
    version: 1, goalId: "goal.missing-joint", phase: "moving", joints: {},
  }, [{ nodeId: "head", jointId: "not-present", maxAbsDegrees: 100 }]), /calibration/);
});
