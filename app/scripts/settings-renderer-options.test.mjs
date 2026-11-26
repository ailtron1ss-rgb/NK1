import assert from "node:assert/strict";
import test from "node:test";
import {
  SETTINGS_RENDERER_ID_BY_VIEW_MODE,
  SETTINGS_RENDERER_OPTIONS,
  buildSettingsRendererOptions,
} from "../src/components/avatar/settingsRendererOptions.ts";

test("Settings selector is generated from the canonical four renderer manifests", () => {
  assert.deepEqual(
    Object.keys(SETTINGS_RENDERER_ID_BY_VIEW_MODE),
    ["live2d", "original", "legacy", "3d"],
  );
  assert.deepEqual(
    SETTINGS_RENDERER_OPTIONS.map((option) => option.id),
    ["live2d", "original", "legacy", "3d"],
  );

  const ids = SETTINGS_RENDERER_OPTIONS.map((option) => option.rendererId);
  assert.deepEqual(ids, [
    "nk1-live2d-cubism",
    "nk1-original-svg-2d",
    "nk1-legacy-sprites-2d",
    "nk1-three-vrm3d",
  ]);
  assert.ok(SETTINGS_RENDERER_OPTIONS.every((option) =>
    option.description.includes("канал") && option.description.includes("выражен"),
  ));
});

test("3D Settings option stays visibly preview-only when its manifest is not production-ready", () => {
  const three = SETTINGS_RENDERER_OPTIONS.find((option) => option.id === "3d");
  assert.ok(three);
  assert.equal(three.productionReady, false);
  assert.match(three.label, /предпросмотр/i);
  assert.match(three.availability, /визуальн.*мобильн.*лицензионн/i);
});

test("selector generation fails closed when a wired renderer is missing or duplicated", () => {
  assert.throws(() => buildSettingsRendererOptions([]), /missing renderer manifest/i);
  const duplicate = SETTINGS_RENDERER_OPTIONS.map((option) => ({
    rendererId: option.rendererId,
    id: option.id,
  }));
  assert.equal(new Set(duplicate.map((item) => item.rendererId)).size, 4);
});
