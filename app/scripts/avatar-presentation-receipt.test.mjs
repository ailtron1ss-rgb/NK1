import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAvatarPresentationReceipt,
  describeAvatarFrameStatus,
  isCurrentAvatarPresentationReceipt,
} from "../src/components/avatar/avatarPresentationReceipt.ts";

const [stage, original, three, receiptContract] = await Promise.all([
  readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/avatar/avatarPresentationReceipt.ts", import.meta.url), "utf8"),
]);

test("Original2D emits a tick-bound DOM receipt only after the SVG is committed and measurable", () => {
  assert.match(original, /frameTick: number/);
  assert.match(original, /onFrameReceipt\?: \(receipt: AvatarPresentationReceiptV1\) => void/);
  assert.match(original, /useLayoutEffect/);
  assert.match(original, /requestAnimationFrame/);
  assert.match(original, /svgRoot\.current/);
  assert.match(original, /getBBox\(\)/);
  assert.match(original, /isConnected/);
  assert.match(original, /dom-committed/);
  assert.match(original, /createAvatarPresentationReceipt\("original2d", frameTick, "dom-committed"\)/);
});

test("3D emits a renderer-submitted receipt only after the loaded model produces a draw call", () => {
  const renderAt = three.indexOf("renderer.render(scene,camera)");
  const receiptAt = three.indexOf("webgl-render-submitted");
  assert.ok(renderAt >= 0, "the 3D loop must render the scene");
  assert.ok(receiptAt > renderAt, "the receipt must be emitted after renderer.render returns");
  assert.match(three, /p\.frameTick/);
  assert.match(three, /rt\.loaded/);
  assert.match(three, /renderer\.info\.render\.calls\s*>\s*0/);
  assert.match(three, /visualCompletionVerified:\s*false/);
});

test("AvatarStage surfaces current-tick receipts without claiming that pixels were presented", () => {
  assert.match(stage, /createAvatarPresentationReceipt/);
  assert.match(stage, /isCurrentAvatarPresentationReceipt/);
  assert.match(receiptContract, /visualCompletionVerified: false/);
  assert.match(receiptContract, /Показ кадра не подтверждён/);
  assert.match(stage, /renderer-readback/);
  assert.match(stage, /onFrameReceipt=/);
  assert.match(stage, /frameTick=\{snap\.tick\}/);
});

test("receipt builder binds the canonical tick and never promotes a renderer stage to visual completion", () => {
  const live2d = createAvatarPresentationReceipt("live2d", 42, "parameters-observed");
  const original2d = createAvatarPresentationReceipt("original2d", 42, "dom-committed");
  const threeD = createAvatarPresentationReceipt("webgl3d", 42, "webgl-render-submitted");
  assert.deepEqual([live2d?.tick, live2d?.stateVersion], [42, 42]);
  assert.equal(original2d?.stage, "dom-committed");
  assert.equal(threeD?.stage, "webgl-render-submitted");
  for (const receipt of [live2d, original2d, threeD]) assert.equal(receipt?.visualCompletionVerified, false);
  assert.equal(createAvatarPresentationReceipt("live2d", -1, "parameters-observed"), null);
  assert.equal(createAvatarPresentationReceipt("original2d", 42, "parameters-observed"), null);
  assert.equal(createAvatarPresentationReceipt("webgl3d", Number.NaN, "webgl-render-submitted"), null);
});

test("current receipt matching requires the same renderer and same canonical tick", () => {
  const receipt = createAvatarPresentationReceipt("live2d", 42, "parameters-observed");
  assert.equal(isCurrentAvatarPresentationReceipt(receipt, "live2d", 42), true);
  assert.equal(isCurrentAvatarPresentationReceipt(receipt, "live2d", 43), false);
  assert.equal(isCurrentAvatarPresentationReceipt(receipt, "original", 42), false);
  assert.equal(isCurrentAvatarPresentationReceipt(null, "live2d", 42), false);
  assert.equal(isCurrentAvatarPresentationReceipt({ ...receipt, visualCompletionVerified: true }, "live2d", 42), false);
});

test("UI labels distinguish DOM commit, WebGL submission and Live2D readback from a presented frame", () => {
  const live = createAvatarPresentationReceipt("live2d", 42, "parameters-observed");
  const original = createAvatarPresentationReceipt("original2d", 42, "dom-committed");
  const three = createAvatarPresentationReceipt("webgl3d", 42, "webgl-render-submitted");
  assert.match(describeAvatarFrameStatus("live2d", 42, live), /параметры прочитаны; показ кадра не подтверждён/);
  assert.match(describeAvatarFrameStatus("original", 42, original), /SVG DOM сформирован; показ кадра не подтверждён/);
  assert.match(describeAvatarFrameStatus("3d", 42, three), /WebGL draw call отправлен; показ кадра не подтверждён/);
  assert.match(describeAvatarFrameStatus("live2d", 43, live), /ожидается подтверждение текущего renderer/);
  assert.match(describeAvatarFrameStatus("legacy", 42, null), /статичный fallback/);
});
