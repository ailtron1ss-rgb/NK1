import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stagePath = new URL("../src/components/AvatarStage.tsx", import.meta.url);

test("renderer mode controls stay outside the avatar hit surface and expose a named toolbar", async () => {
  const stage = await readFile(stagePath, "utf8");

  assert.match(stage, /<div role="toolbar" aria-label="Управление аватаром"/,
    "the mode/voice controls must be exposed as a named toolbar");
  assert.match(stage, /className=\{cn\(mode === "3d" \|\| mode === "legacy" \|\| mode === "original" \? "relative z-30 flex w-full flex-wrap items-center gap-2 border-b border-border bg-black\/70 p-2 backdrop-blur"\s*:\s*"absolute left-3 top-3 z-30 flex max-w-\[calc\(100%-1\.5rem\)\] flex-wrap gap-1 rounded-md border border-border bg-black\/60 p-1 backdrop-blur"\)\}/,
    "3D and Legacy controls must take a dedicated layout row instead of covering pointer/touch targets");
});

test("avatar mode controls announce the selected renderer and expose an accessible mode group", async () => {
  const stage = await readFile(stagePath, "utf8");
  assert.match(stage, /<div role="group" aria-label="Режим отображения персонажа"/);
  const expected = {
    live2d: "Выбрать Live2D — деформируемый Cubism-риг",
    legacy: "Выбрать Legacy — статичные PNG-позы без рига",
    original: "Выбрать NK1 Original — SVG-вектор с ограниченной 2D-анимацией",
    "3d": "Выбрать 3D preview — VRM/GLB кандидат, пока не production",
  };
  for (const mode of ["live2d", "legacy", "original", "3d"]) {
    assert.ok(stage.includes(`aria-pressed={mode === "${mode}"}`), `missing pressed state for ${mode}`);
    assert.ok(stage.includes(`aria-label="${expected[mode]}"`), `missing accurate accessible label for ${mode}`);
  }
  for (const descriptor of ["Cubism rig · деформируемое 2D-тело", "Static sprites · готовые PNG-позы без рига", "SVG vector · ограниченная 2D-анимация, не полноценный rig", "VRM / GLB · preview-кандидат, не production-тело"]) {
    assert.ok(stage.includes(descriptor), "missing truthful visible renderer description: " + descriptor);
  }
  assert.match(stage, /title="Live2D · деформируемый Cubism-риг"/);
  assert.match(stage, /title="Legacy · статичные PNG-позы, без деформируемого рига"/);
  assert.match(stage, /title="NK1 Original · SVG-вектор, не полноценный rig"/);
  assert.match(stage, /title="3D preview · VRM\/GLB кандидат, не production body"/);
});
