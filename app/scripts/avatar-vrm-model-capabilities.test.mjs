import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectVrmModelCapabilities,
  summarizeVrmModelCapabilities,
  VRM_HUMANOID_BONE_NAMES,
} from "../src/components/avatar/vrmModelCapabilities.ts";

function makeVrm({ missing = [], expressions = [], springJoints = 0, lookAt = true, skinned = true } = {}) {
  const absent = new Set(missing);
  const nodes = [];
  const humanoid = {
    getNormalizedBoneNode(name) {
      if (absent.has(name)) return null;
      return { name };
    },
  };
  const expressionManager = {
    expressions: expressions.map((expressionName) => ({ expressionName })),
    getValue(name) { return expressions.includes(name) ? 0 : null; },
  };
  const scene = {
    traverse(visitor) {
      visitor({ isSkinnedMesh: skinned, isMesh: true });
      visitor({ isBone: true });
    },
  };
  return {
    humanoid,
    expressionManager,
    springBoneManager: { joints: Array.from({ length: springJoints }, (_, index) => index) },
    lookAt: lookAt ? {} : null,
    scene,
  };
}

test("inspects the complete VRM humanoid vocabulary, including hands and fingers", () => {
  const report = inspectVrmModelCapabilities(makeVrm(), 2);
  assert.equal(report.humanoid.total, VRM_HUMANOID_BONE_NAMES.length);
  assert.equal(report.humanoid.available, VRM_HUMANOID_BONE_NAMES.length);
  assert.deepEqual(report.humanoid.missing, []);
  assert.equal(report.humanoid.coreComplete, true);
  assert.equal(report.humanoid.upperBody, true);
  assert.equal(report.humanoid.lowerBody, true);
  assert.equal(report.humanoid.hands, true);
  assert.equal(report.humanoid.fingers, true);
  assert.equal(report.motion.embeddedClips, 2);
  assert.equal(report.grade, "full");
});

test("reports missing limbs, hands, fingers, face and physics without throwing", () => {
  const report = inspectVrmModelCapabilities(makeVrm({
    missing: ["leftUpperArm", "rightUpperArm", "leftUpperLeg", "rightUpperLeg", "leftHand", "rightHand", "leftIndexProximal", "rightIndexProximal"],
    expressions: ["happy", "blink"],
    springJoints: 0,
    lookAt: false,
    skinned: false,
  }));
  assert.equal(report.humanoid.upperBody, false);
  assert.equal(report.humanoid.lowerBody, false);
  assert.equal(report.humanoid.hands, false);
  assert.equal(report.humanoid.fingers, false);
  assert.equal(report.face.blink, true);
  assert.equal(report.motion.lookAt, false);
  assert.equal(report.geometry.skinnedMeshes, 0);
  assert.ok(report.warnings.length >= 5);
  assert.equal(report.grade, "static");
});

test("accepts partial but usable humanoid rigs as body-grade, not full", () => {
  const report = inspectVrmModelCapabilities(makeVrm({
    missing: ["leftHand", "rightHand", "leftIndexProximal", "rightIndexProximal"],
    expressions: ["happy", "blink", "aa", "ih", "ou"],
    springJoints: 4,
    lookAt: true,
  }));
  assert.equal(report.grade, "body");
  assert.equal(report.humanoid.coreComplete, true);
  assert.equal(report.humanoid.upperBody, true);
  assert.equal(report.humanoid.lowerBody, true);
});

test("recognizes plain GLB as non-VRM and explains capability limits", () => {
  const report = inspectVrmModelCapabilities(null);
  assert.equal(report.isVrm, false);
  assert.equal(report.grade, "static");
  assert.match(summarizeVrmModelCapabilities(report), /статическая/);
  assert.ok(report.warnings.some((warning) => warning.includes("VRM")));
});

test("does not crash when optional VRM managers expose malformed shapes", () => {
  const report = inspectVrmModelCapabilities({
    humanoid: { getNormalizedBoneNode: () => { throw new Error("bad bone"); } },
    expressionManager: { expressions: "invalid", getValue: () => { throw new Error("bad expression"); } },
    springBoneManager: { joints: "invalid" },
    scene: { traverse: () => { throw new Error("bad scene"); } },
  });
  assert.equal(report.humanoid.available, 0);
  assert.equal(report.face.expressions.length, 0);
  assert.equal(report.geometry.meshes, 0);
});
