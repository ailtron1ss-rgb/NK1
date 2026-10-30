import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewerUrl = new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html", import.meta.url);
const viewer = await readFile(viewerUrl, "utf8");

test("Live2D ACK is version-bound and emitted after Cubism parameter setters", () => {
  const intentHandler = viewer.indexOf("pendingIntentReadback={stateVersion:normalized.stateVersion");
  const updateHook = viewer.indexOf("model.internalModel?.on?.('beforeModelUpdate',applyModelParameterOverrides)");
  const readback = viewer.indexOf("function flushIntentParameterReadback(core)");
  const emit = viewer.indexOf("send('live2d_intent_ack'");
  const applyHook = viewer.indexOf("flushIntentParameterReadback(core);");
  assert.ok(intentHandler >= 0, "intent revision must be retained");
  assert.ok(readback >= 0 && emit > readback, "ACK must be emitted by the readback routine");
  assert.ok(applyHook > readback && updateHook > applyHook, "readback routine must be registered through the Cubism model-update hook");
});

test("partial ACK never claims complete expression, motion or rendered-frame execution", () => {
  assert.match(viewer, /status:readable\?'parameters-observed':'accepted-unverified'/);
  assert.match(viewer, /complete:false/);
  assert.match(viewer, /expressionStatus:'not-independently-verified'/);
  assert.match(viewer, /motionStatus:'not-independently-verified'/);
  assert.match(viewer, /reason:readable\?null:'core-parameter-readback-unavailable'/);
});

test("readback is fail-closed when the Cubism getter is missing or values are non-finite", () => {
  assert.match(viewer, /typeof core\.getParameterValueById==='function'/);
  assert.match(viewer, /if\(Number\.isFinite\(value\)\)observed\[id\]=value;\s*else readable=false;/);
});
