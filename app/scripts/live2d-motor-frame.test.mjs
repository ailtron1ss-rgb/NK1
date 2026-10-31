import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewer = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
const avatar = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");

test("Live2D viewer binds mobile and balanced Cubism models to stable MotorFrame model ids", () => {
  assert.match(viewer, /kurisu-live2d-mobile-v1/);
  assert.match(viewer, /kurisu-live2d-balanced-v1/);
  assert.match(viewer, /send\('live2d_ready',\{profile:assetProfile,modelPath,modelId:modelIdForProfile\(assetProfile\)\}\)/);
  assert.match(avatar, /ev\.data\.modelId !== live2dIdentity/);
});

test("Live2D accepts only calibrated Cubism parameter commands for its exact loaded model", () => {
  assert.match(viewer, /function sanitizeLive2DMotorBatch\(raw\)/);
  assert.match(viewer, /raw\.renderer!=='live2d'/);
  assert.match(viewer, /raw\.modelId!==expectedModelId/);
  assert.match(viewer, /\^Param\[A-Za-z0-9_\]\{1,56\}\$/);
  assert.match(viewer, /command\.targetKind!=='cubism-parameter'/);
  assert.match(viewer, /command\.component!=='value'\|\|command\.valueUnit!=='parameter'/);
  assert.match(viewer, /Math\.abs\(command\.value\)>100/);
  assert.match(viewer, /jointIds\.has\(command\.jointId\)\|\|targets\.has\(command\.targetId\)/);
});

test("Live2D applies the MotorFrame from the Cubism model update hook and reports parameter-only readback", () => {
  assert.match(viewer, /model\.internalModel\?\.on\?\.\('beforeModelUpdate',applyModelParameterOverrides\)/);
  assert.match(viewer, /core\.setParameterValueById\(command\.targetId,command\.value,1\)/);
  assert.match(viewer, /core\.getParameterValueById\(command\.targetId\)/);
  assert.match(viewer, /send\('live2d_motor_frame_ack'/);
  assert.match(viewer, /visualCompletionVerified:false/);
  assert.match(avatar, /ack\.visualCompletionVerified !== false/);
});

test("AvatarStage streams Live2D commands through the same renderer-neutral MotorFrame adapter", () => {
  assert.match(avatar, /renderer: "live2d"/);
  assert.match(avatar, /url: neuroApiUrl\("\/api\/organism\/motor-frame\/stream"\)/);
  assert.match(avatar, /motorFrameBatch: live2dMotorBatch/);
  assert.match(avatar, /setLive2dMotorProjection\(projection\.state\)/);
  assert.match(avatar, /live2dMotorAck\.observedCount/);
});
