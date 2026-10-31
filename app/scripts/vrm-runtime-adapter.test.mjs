import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyVrmExpressionFrame,
  configureVrmForNk1RawBoneDrive,
  summarizeVrmMeta,
  updateVrmForNk1Frame,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";

function createFakeVrm() {
  const values = new Map();
  let resetCount = 0;
  let updateDelta = null;
  return {
    humanoid: { autoUpdateHumanBones: true },
    expressionManager: {
      resetValues() { values.clear(); resetCount += 1; },
      setValue(name, weight) { values.set(name, weight); },
    },
    update(delta) { updateDelta = delta; },
    values,
    get resetCount() { return resetCount; },
    get updateDelta() { return updateDelta; },
  };
}

test("VRM adapter preserves NK1 raw-bone motor ownership", () => {
  const vrm = createFakeVrm();
  configureVrmForNk1RawBoneDrive(vrm);
  assert.equal(vrm.humanoid.autoUpdateHumanBones, false);
  assert.equal(vrm.resetCount, 1);
});

test("VRM expression mapping follows NK1 affect and speech frame", () => {
  const vrm = createFakeVrm();
  applyVrmExpressionFrame(vrm, {
    emotion: "joy",
    speaking: true,
    mouthOpen: 0.7,
    mouthForm: -0.6,
    blink: true,
  });
  assert.equal(vrm.values.get("happy"), 0.78);
  assert.equal(vrm.values.get("oh"), 0.7);
  assert.equal(vrm.values.get("blink"), 1);

  applyVrmExpressionFrame(vrm, {
    emotion: "anger",
    speaking: true,
    mouthOpen: 2,
    mouthForm: 0.8,
    blink: false,
  });
  assert.equal(vrm.values.has("happy"), false);
  assert.equal(vrm.values.get("angry"), 0.72);
  assert.equal(vrm.values.get("ee"), 1);
  assert.equal(vrm.values.has("blink"), false);
});

test("VRM update uses bounded frame delta and rejects invalid time", () => {
  const vrm = createFakeVrm();
  updateVrmForNk1Frame(vrm, 0.016);
  assert.equal(vrm.updateDelta, 0.016);
  updateVrmForNk1Frame(vrm, 0.2);
  assert.equal(vrm.updateDelta, 0.05);
  updateVrmForNk1Frame(vrm, Number.NaN);
  updateVrmForNk1Frame(vrm, -1);
  assert.equal(vrm.updateDelta, 0.05);
  updateVrmForNk1Frame(null, 0.016);
});

test("VRM 1 metadata is summarized without treating it as license approval", () => {
  const result = summarizeVrmMeta({
    metaVersion: "1",
    name: "Kurisu Sample",
    authors: ["Author A", "Author B"],
    licenseUrl: "https://example.invalid/license",
    avatarPermission: "everyone",
    creditNotation: "required",
  });
  assert.equal(result.modelName, "Kurisu Sample");
  assert.deepEqual(result.authors, ["Author A", "Author B"]);
  assert.equal(result.license, "https://example.invalid/license");
  assert.equal(result.avatarPermission, "everyone");
  assert.equal(result.credit, "required");
});

test("VRM 0 metadata is supported and missing license remains explicit", () => {
  const result = summarizeVrmMeta({
    metaVersion: "0",
    title: "Legacy Avatar",
    author: "Legacy Author",
    licenseName: "CC_BY_NC",
    allowedUserName: "Everyone",
  });
  assert.equal(result.modelName, "Legacy Avatar");
  assert.deepEqual(result.authors, ["Legacy Author"]);
  assert.equal(result.license, "CC_BY_NC");
  assert.equal(result.avatarPermission, "Everyone");
  assert.equal(result.credit, "check model license");

  const missing = summarizeVrmMeta(undefined);
  assert.equal(missing.license, "not declared");
});

test("Avatar3DStage registers the native plugin and updates/disposes VRM runtime", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /new VRMLoaderPlugin\(parser,\s*\{\s*autoUpdateHumanBones:\s*false\s*\}\)/);
  assert.match(stage, /gltf\.userData\?\.vrm/);
  assert.match(stage, /VRMUtils\.rotateVRM0\(vrm\)/);
  assert.match(stage, /updateVrmForNk1Frame\(rt\.vrm,dt\)/);
  assert.match(stage, /VRMUtils\.deepDispose\(rt\.loaded\)/);
  assert.match(stage, /applyVrmExpressionFrame\(rt\.vrm/);
});
