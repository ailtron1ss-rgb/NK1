import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/components/", import.meta.url);

test("Original 2D receives a canonical cognitive-affect signal bundle from AvatarStage", async () => {
  const stage = await readFile(new URL("AvatarStage.tsx", root), "utf8");
  assert.match(stage, /<KurisuOriginalStage[\s\S]*motorSignals=\{\{/);
  for (const signal of ["energy", "cognitiveLoad", "uncertainty", "socialNeed", "novelty", "goalPressure", "predictionError", "traits"]) {
    assert.match(stage, new RegExp(signal + ":\\s*snap\\."));
  }
});

test("Original 2D projects the shared motor planner instead of re-deriving emotion-only poses", async () => {
  const original = await readFile(new URL("KurisuOriginalStage.tsx", root), "utf8");
  assert.match(original, /planAvatarMotorIntent/);
  assert.match(original, /motorSignals/);
  for (const signal of ["energy", "cognitiveLoad", "uncertainty", "socialNeed", "novelty", "goalPressure", "predictionError", "traits"]) {
    assert.match(original, new RegExp(signal + ":\\s*motorSignals\\."));
  }
  assert.match(original, /motorPlan\\.headTilt/);
  assert.match(original, /motorPlan\\.action/);
});

test("manual Original 2D pose override remains authoritative over automatic motor pose", async () => {
  const original = await readFile(new URL("KurisuOriginalStage.tsx", root), "utf8");
  assert.match(original, /poseOverride === "auto" \? automaticPoseForMotorPlan\(motorPlan[\s\S]*: poseOverride/);
});

test("the 2D avatar keeps outfit and visual customization independent from organism motor state", async () => {
  const original = await readFile(new URL("KurisuOriginalStage.tsx", root), "utf8");
  for (const key of ["kurisu-original-outfit", "kurisu-original-eyes", "kurisu-original-hair", "kurisu-original-accent", "kurisu-original-motion", "kurisu-original-pose"]) {
    assert.ok(original.includes(key), "missing persisted visual preference: " + key);
  }
});
