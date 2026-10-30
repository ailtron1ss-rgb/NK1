import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewerUrl = new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html", import.meta.url);
const viewer = await readFile(viewerUrl, "utf8");

test("Live2D ACK is revision-bound and waits for Cubism readback plus requested action starts", () => {
  const intentHandler = viewer.indexOf("pendingIntentReadback={");
  const maybeEmit = viewer.indexOf("function maybeEmitIntentAck(pending)");
  const emit = viewer.indexOf("send('live2d_intent_ack'");
  const readback = viewer.indexOf("function flushIntentParameterReadback(core)");
  const updateHook = viewer.indexOf("model.internalModel?.on?.('beforeModelUpdate',applyModelParameterOverrides)");
  const applyHook = viewer.indexOf("flushIntentParameterReadback(core);");
  assert.ok(intentHandler >= 0, "intent revision must be retained");
  assert.ok(maybeEmit >= 0 && emit > maybeEmit, "ACK must be emitted only by the guarded ACK aggregator");
  assert.ok(readback > maybeEmit && readback < updateHook, "readback routine must be registered through the Cubism model-update hook");
  assert.ok(applyHook > readback && updateHook > applyHook, "readback must run after Cubism parameter setters");
  assert.match(viewer, /if\(pending\.expressionStatus==='pending'\|\|pending\.motionStatus==='pending'\)return;/);
  assert.match(viewer, /pending\.readback=/);
  assert.match(viewer, /pending\.stateVersion!==lastIntentStateVersion/);
});

test("partial ACK distinguishes command start from unavailable or failed action and never claims visual completion", () => {
  assert.match(viewer, /ok===true\?'started':'unavailable'/);
  assert.match(viewer, /settleIntentAction\(pending,channel,'error'\)/);
  assert.match(viewer, /expressionStatus:pending\.expressionStatus/);
  assert.match(viewer, /motionStatus:pending\.motionStatus/);
  assert.match(viewer, /complete:false/);
  assert.match(viewer, /visualCompletionVerified:false/);
});

test("unchanged expression and unchanged motion do not leave an ACK pending", () => {
  assert.match(viewer, /Promise\.resolve\('not-requested'\)/);
  assert.match(viewer, /expressionStatus:'not-requested'/);
  assert.match(viewer, /motionStatus:'not-requested'/);
  assert.match(viewer, /ok==='not-requested'\?'not-requested'/);
});

test("readback is fail-closed when the Cubism getter is missing or values are non-finite", () => {
  assert.match(viewer, /typeof core\.getParameterValueById==='function'/);
  assert.match(viewer, /if\(Number\.isFinite\(value\)\)observed\[id\]=value;\s*else readable=false;/);
  assert.match(viewer, /reason:readable\?null:'core-parameter-readback-unavailable'/);
});

test("AvatarStage accepts only the latest same-origin partial ACK and never upgrades it to a receipt", async () => {
  const avatarUrl = new URL("../src/components/AvatarStage.tsx", import.meta.url);
  const avatar = await readFile(avatarUrl, "utf8");
  assert.match(avatar, /ev\.origin !== window\.location\.origin \|\| ev\.source !== frame\.current\?\.contentWindow/);
  assert.match(avatar, /typeof version !== "number" \|\| !Number\.isSafeInteger\(version\)/);
  assert.match(avatar, /version !== latestIntentStateVersionRef\.current/);
  assert.match(avatar, /ev\.data\.appliedRevision !== version \|\| ev\.data\.complete !== false/);
  assert.match(avatar, /ev\.data\.visualCompletionVerified !== false/);
  assert.match(avatar, /isLive2DActionStatus\(ev\.data\.expressionStatus\)/);
  assert.match(avatar, /isLive2DActionStatus\(ev\.data\.motionStatus\)/);
  assert.match(avatar, /partial ACK is never a renderer receipt/);
  assert.match(avatar, /latestIntentStateVersionRef\.current = intent\.stateVersion/);
});
