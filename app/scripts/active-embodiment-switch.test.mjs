import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parent = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
const scene = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
const viewer = await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html", import.meta.url), "utf8");
const coordinator = await readFile(new URL("../src/components/avatar/embodimentCoordinator.ts", import.meta.url), "utf8");

test("all selectable canonical bodies use the transactional coordinator, not direct UI mode mutation", () => {
  assert.match(parent, /new EmbodimentSwitchCoordinator/);
  assert.match(parent, /\.switchTo\(createEmbodimentAdapter\(targetMode\), snapshot/);
  for (const mode of ["live2d", "2.5d", "3d"]) {
    assert.match(parent, new RegExp('requestViewMode\\("' + mode.replace(".", "\\.") + '"\\)'));
  }
  assert.match(parent, /onRendererSignal=\{publishRendererSignal\}/);
  assert.match(parent, /switchExecutionId=\{activeSwitch\?\.executionId/);
  assert.match(parent, /switchStateRevision=\{activeSwitch\?\.revision/);
});

test("renderer signals are scoped to execution, adapter and state revision", () => {
  assert.match(parent, /signalKey = \(executionId: string, adapterId: string, kind: string\)/);
  assert.match(parent, /signal\.kind === "failed"/);
  assert.match(parent, /renderer-ready-revision-mismatch/);
  assert.match(parent, /renderer-apply-receipt-missing/);
  assert.match(parent, /renderer-verification-missing/);
  assert.match(coordinator, /switchExecutionId|executionId/);
  assert.match(coordinator, /rolled-back/);
});

test("3D and 2.5D report apply only after render and verify a later scene graph readback", () => {
  assert.match(scene, /renderer\.render\(scene,camera\);[\s\S]*kind:"apply"/);
  assert.match(scene, /renderer\.info\.render\.frame>progress\.applyFrame/);
  assert.match(scene, /matrixWorld\.elements\.every\(Number\.isFinite\)/);
  assert.match(scene, /kind:"verify"/);
  assert.match(scene, /nk1-depth-rig-scene-v1/);
  assert.match(scene, /nk1-three-scene-v1/);
});

test("Live2D switch ACKs use Cubism readback, persist across repeated state intents and never claim a presented frame", () => {
  assert.match(parent, /live2d_switch_apply_receipt/);
  assert.match(parent, /live2d_switch_verification/);
  assert.match(parent, /switchExecutionId: activeSwitch\?\.executionId/);
  assert.match(viewer, /pendingSwitchReadback\.executionId!==switchExecutionId/);
  assert.match(viewer, /send\('live2d_switch_apply_receipt'/);
  assert.match(viewer, /send\('live2d_switch_verification'/);
  assert.match(viewer, /visualCompletionVerified:false/);
});
