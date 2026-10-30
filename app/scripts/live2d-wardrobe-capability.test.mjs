import assert from "node:assert/strict";
import test from "node:test";
import { inspectLive2DWardrobeCapability } from "../src/components/avatar/live2dWardrobeCapability.ts";

const model = {
  Version: 3,
  FileReferences: {
    Moc: "Kurisu.moc3",
    Textures: ["texture_00.png"],
    Motions: { Idle: [{}], Special: [{}, {}] },
    Expressions: [{ Name: "Arm Change", File: "Arm Change.exp3.json" }],
  },
};
const display = { Parameters: [
  { Id: "ParamBodyAngleX", Name: "Body X" },
  { Id: "LowerCoatPhy1", Name: "Lower coat physics" },
  { Id: "HandChange", Name: "Hand change" },
] };

test("texture atlas and coat physics do not falsely imply modular clothing", () => {
  const result = inspectLive2DWardrobeCapability(model, display, {
    "Arm Change.exp3.json": { Parameters: [{ Id: "HandChange", Value: 1 }] },
  });
  assert.equal(result.status, "limited-controls");
  assert.equal(result.canSwitchGarments, false);
  assert.equal(result.textureCount, 1);
  assert.equal(result.motionGroupCount, 2);
  assert.ok(result.limitations.includes("texture-atlas-is-not-an-interchangeable-garment"));
});

test("explicit outfit parameter is recognized as a candidate switch contract", () => {
  const result = inspectLive2DWardrobeCapability(model, {
    Parameters: [...display.Parameters, { Id: "ParamOutfitVariant", Name: "Outfit variant" }],
  });
  assert.equal(result.status, "switchable");
  assert.equal(result.canSwitchGarments, true);
  assert.deepEqual(result.wardrobeControlIds, ["ParamOutfitVariant"]);
});

test("incomplete model manifest is rejected instead of guessed", () => {
  const result = inspectLive2DWardrobeCapability({ Version: 3, FileReferences: {} }, display);
  assert.equal(result.status, "invalid-manifest");
  assert.equal(result.canSwitchGarments, false);
});
