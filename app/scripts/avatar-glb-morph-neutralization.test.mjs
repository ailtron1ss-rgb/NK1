import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resetNk1ControlledGlbFacialMorphs } from "../src/components/avatar/glbMorphNeutralization.ts";

function makeRoot(meshes) {
  return {
    traverse(visitor) {
      for (const mesh of meshes) visitor(mesh);
    },
  };
}

test("neutralizes imported NK1 facial and viseme weights but preserves unrelated morphs", () => {
  const influences = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0.4, 0.3];
  const root = makeRoot([{
    isMesh: true,
    name: "FACE_mouth",
    morphTargetDictionary: {
      happy: 0,
      sad: 1,
      angry: 2,
      viseme_aa: 3,
      viseme_oh: 4,
      viseme_ee: 5,
      viseme_ih: 6,
      viseme_ou: 7,
      blink: 8,
      corrective_jaw_shape: 9,
      nk1clothsway: 10,
    },
    morphTargetInfluences: influences,
  }]);

  const report = resetNk1ControlledGlbFacialMorphs(root);

  assert.equal(report.meshCount, 1);
  assert.equal(report.managedTargetCount, 9);
  assert.equal(report.resetTargetCount, 9);
  assert.deepEqual(influences.slice(0, 9), Array(9).fill(0));
  assert.equal(influences[9], 0.4, "unknown authored corrective morph must remain untouched");
  assert.equal(influences[10], 0.3, "secondary-physics morph must remain owned by its runtime");
});

test("handles multiple meshes, duplicate target indices, and malformed dictionary entries", () => {
  const first = [0.8, 0.2];
  const second = [0.6];
  const report = resetNk1ControlledGlbFacialMorphs(makeRoot([
    {
      isMesh: true,
      morphTargetDictionary: { mouthOpen: 0, jaw_open: 0, happy: 8, unknown: 1 },
      morphTargetInfluences: first,
    },
    {
      isMesh: true,
      morphTargetDictionary: { wink_left: 0, not_a_face_channel: 1 },
      morphTargetInfluences: second,
    },
    { isMesh: false, morphTargetDictionary: { happy: 0 }, morphTargetInfluences: [1] },
  ]));

  assert.equal(report.meshCount, 2);
  assert.equal(report.managedTargetCount, 2);
  assert.equal(report.resetTargetCount, 2);
  assert.deepEqual(first, [0, 0.2]);
  assert.deepEqual(second, [0]);
});

test("GLB face weights are neutralized before source bounds and the skin audit", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  const resetCall = stage.indexOf("resetNk1ControlledGlbFacialMorphs(root)");
  const sourceBounds = stage.indexOf("resolveAvatarSceneBounds(root)");
  const skinAudit = stage.indexOf("const skinAudit = {");

  assert.ok(resetCall >= 0, "generic GLB loader must initialize NK1-controlled facial morphs");
  assert.ok(sourceBounds > resetCall, "source geometry bounds must observe the neutralized morph state");
  assert.ok(skinAudit > resetCall, "the skin/morph vertex audit must observe the neutralized morph state");
});
