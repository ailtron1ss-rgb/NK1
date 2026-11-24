import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/components/", import.meta.url);

test("Original 2D receives one canonical shared projection from AvatarStage", async () => {
  const stage = await readFile(new URL("AvatarStage.tsx", root), "utf8");
  assert.match(stage, /<KurisuOriginalStage[\s\S]*motorPlan=\{projection\.motorPlan\}/);
  assert.match(stage, /motorSignals=\{\{/);
  assert.match(stage, /energy:\s*snap\.needs\.energy/);
  assert.match(stage, /cognitiveLoad:\s*snap\.needs\.cognitiveLoad/);
  assert.match(stage, /action=\{snap\.lastOption\}/);
});

test("Original 2D adapts the supplied plan without recomputing cognitive-affect intent", async () => {
  const original = await readFile(new URL("KurisuOriginalStage.tsx", root), "utf8");
  assert.match(original, /motorPlan: AvatarMotorIntentPlan/);
  assert.doesNotMatch(original, /planAvatarMotorIntent/);
  assert.match(original, /poseForMotorPlan\(motorPlan,\s*motorSignals\.energy,\s*motorSignals\.cognitiveLoad/);
  assert.match(original, /motorPlan\.headTilt/);
  assert.match(original, /motorPlan\.action/);
  assert.match(original, /data-organism-action=\{action\}/);
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
