import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stage, original, three] = await Promise.all([
  readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"),
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
  assert.match(original, /stateVersion: frameTick/);
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
  assert.match(stage, /visualCompletionVerified:\s*false/);
  assert.match(stage, /Показ кадра не подтверждён/);
  assert.match(stage, /renderer-readback/);
  assert.match(stage, /onFrameReceipt=/);
  assert.match(stage, /frameTick=\{snap\.tick\}/);
});
