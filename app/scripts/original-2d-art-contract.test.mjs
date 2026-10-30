import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = join(appRoot, "src/components/KurisuOriginalStage.tsx");
const contractPath = join(appRoot, "public/kurisu-original/character-art-contract.json");
const source = await readFile(componentPath, "utf8");
const contract = JSON.parse(await readFile(contractPath, "utf8"));

test("Original 2D paint-server IDs are unique per mounted component instance", () => {
  assert.match(source, /useId/);
  assert.match(source, /const instanceId = useId\(\)\.replace\(\/\:\/g, ""\)/);
  for (const key of ["hair", "coat", "skin", "iris", "grid", "glow"]) {
    assert.match(source, new RegExp(`\\$\\{instanceId\\}-${key}`));
    assert.match(source, new RegExp(`id=\\{svgIds\\.${key}\\}`));
    assert.match(source, new RegExp(`url\\(#\\$\\{svgIds\\.${key}\\}\\)`));
  }
  assert.doesNotMatch(source, /url\(#nk-(?:hair|coat|skin|iris|grid|glow)\)/);
});

test("Original 2D identity contract pins the current concept defaults", () => {
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.id, "nk1-kurisu-original-2d");
  assert.deepEqual(contract.viewBox, [0, 0, 420, 560]);
  assert.equal(contract.identity.hairAccessory, "slim red hair clip on the character's left fringe");
  assert.equal(contract.palette.eyes.default, "#b5a4ff");
  assert.ok(contract.requiredViews.includes("front-three-quarter-left"));
  assert.ok(contract.requiredExpressions.includes("protective"));
  assert.ok(contract.requiredOutfits.includes("laboratory"));
});

test("art contract explicitly distinguishes production artwork from current SVG and palette variants", () => {
  assert.ok(contract.explicitNonGoals.some((item) => item.includes("current SVG")));
  assert.ok(contract.explicitNonGoals.some((item) => item.includes("Color variants")));
  assert.equal(contract.productionAssetRequirements.noFlattenedOnlyDelivery, true);
  assert.equal(contract.productionAssetRequirements.allHiddenOccludedAreasForPoseChanges, true);
});

test("Original 2D component remains an organism-state-driven SVG concept with persistent user overrides", () => {
  assert.match(source, /emotion: EmotionLabel/);
  assert.match(source, /action: ActionKind/);
  assert.match(source, /mouthPose: MouthPose/);
  assert.match(source, /kurisu-original-outfit/);
  assert.match(source, /kurisu-original-pose/);
  assert.match(source, /aria-expanded=\{settingsOpen\}/);
});


test("future 2.5D handoff defines rig-safe anatomy, pivots, depth and deformation gates without claiming a rig", () => {
  const handoff = contract.future2_5dHandoff;
  assert.equal(handoff.status, "requirements-only-not-rigged");
  assert.equal(handoff.coordinateSystem.origin, "top-left");
  assert.ok(handoff.depthPlanes.length >= 8);
  assert.ok(handoff.requiredMovingGroups.includes("forearm-left"));
  assert.ok(handoff.requiredMovingGroups.includes("jaw"));
  for (const field of ["id", "parentId", "zIndex", "pivot", "restTransform", "bounds", "occlusion", "deformation", "sourceAssetId"]) assert.ok(handoff.layerRecordRequiredFields.includes(field));
  assert.equal(handoff.pivotRules.everyMovingGroupRequiresPivot, true);
  assert.equal(handoff.occlusionRules.hiddenAnatomyMustExtendBeyondGarmentAndHairMasks, true);
  assert.equal(handoff.meshRules.meshIsOptionalUntilRiggingPhase, true);
  assert.ok(handoff.deformationTestPoses.includes("torso-yaw-and-lean"));
  assert.equal(handoff.cameraAndDepth.doNotInferDepthFromFlatColorOrLayerOrderAlone, true);
  assert.ok(handoff.acceptanceGates.includes("no-visible-seams-holes-or-texture-edge-fringing"));
  assert.match(handoff.promotionPolicy, /visual sign-off and provenance/);
});


test("layered-art handoff schema requires provenance, explicit depth, pivots and review evidence", async () => {
  const schemaPath = join(appRoot, "public/kurisu-original/layered-art-manifest.schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.characterContract.const, contract.id);
  for (const field of ["schemaVersion", "characterContract", "assetId", "canvas", "coordinateSystem", "layers", "provenance", "review"]) {
    assert.ok(schema.required.includes(field));
  }
  const layer = schema.$defs.layer;
  for (const field of ["id", "parentId", "zIndex", "depthPlane", "pivot", "restTransform", "bounds", "occlusion", "deformation", "sourceAssetId"]) {
    assert.ok(layer.required.includes(field));
  }
  assert.deepEqual(schema.properties.provenance.required, ["author", "sourceFile", "sourceUrl", "license", "licenseUrl", "redistributionAllowed"]);
  assert.deepEqual(schema.properties.review.properties.status.enum, ["draft", "needs-revision", "approved"]);
  assert.equal(layer.properties.deformation.properties.mesh.type.includes("null"), true);
});
