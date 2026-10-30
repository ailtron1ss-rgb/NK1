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
