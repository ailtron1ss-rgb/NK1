import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
const original = await readFile(join(root, "src/components/KurisuOriginalStage.tsx"), "utf8");
const three = await readFile(join(root, "src/components/Avatar3DStage.tsx"), "utf8");

test("AvatarStage creates one shared render projection and no longer plans a second Live2D motor intent", () => {
  assert.equal((stage.match(/buildAvatarRenderProjection\(/g) ?? []).length, 1);
  assert.match(stage, /import \{ buildAvatarRenderProjection \} from "\.\/avatar\/avatarRenderProjection\.ts"/);
  assert.doesNotMatch(stage, /planAvatarMotorIntent\(/);
  assert.match(stage, /motorPlan\.motionGroup/);
  assert.match(stage, /speechPhase: projection\.speech\.phase/);
  assert.match(stage, /gaze: projection\.gaze/);
});

test("Original 2D consumes the supplied plan and does not make a duplicate decision", () => {
  assert.match(original, /motorPlan: AvatarMotorIntentPlan/);
  assert.match(original, /poseForMotorPlan\(motorPlan,/);
  assert.doesNotMatch(original, /planAvatarMotorIntent\(/);
});

test("3D consumes the same plan for head and arm intent while raw action remains the GLB clip selector", () => {
  assert.match(three, /motorPlan: AvatarMotorIntentPlan/);
  assert.match(three, /resolveVrmArmIntent\(p\.motorPlan/);
  assert.match(three, /headTilt: p\.motorPlan\.headTilt/);
  assert.match(three, /applyAvatarAnimationFrame\(\{mixer:rt\.mixer,clips:rt\.clips,action:p\.action/);
});
