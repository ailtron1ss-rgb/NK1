import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stagePath = new URL("../src/components/AvatarStage.tsx", import.meta.url);

test("3D and Legacy mode controls stay outside the avatar hit surface and expose a named toolbar", async () => {
  const stage = await readFile(stagePath, "utf8");

  assert.match(stage, /<div role="toolbar" aria-label="Управление аватаром"/,
    "the mode/voice controls must be exposed as a named toolbar");
  assert.match(stage, /className=\{cn\(mode === "3d" \|\| mode === "legacy" \? "relative z-30 flex w-full flex-wrap items-center gap-2 border-b border-border bg-black\/70 p-2 backdrop-blur"\s*:\s*"absolute left-3 top-3 z-30 flex max-w-\[calc\(100%-1\.5rem\)\] flex-wrap gap-1 rounded-md border border-border bg-black\/60 p-1 backdrop-blur"\)\}/,
    "3D and Legacy controls must take a dedicated layout row instead of covering pointer/touch targets");
});

test("avatar mode controls announce the selected renderer and expose an accessible mode group", async () => {
  const stage = await readFile(stagePath, "utf8");
  assert.match(stage, /<div role="group" aria-label="Режим отображения персонажа"/);
  for (const mode of ["live2d", "legacy", "original", "3d"]) {
    assert.ok(stage.includes(`aria-pressed={mode === "${mode}"}`), `missing pressed state for ${mode}`);
    assert.ok(stage.includes(`aria-label="Переключить на режим ${mode === "live2d" ? "Live2D" : mode === "legacy" ? "Legacy" : mode === "original" ? "NK1 Original" : "3D preview"}"`),
      `missing accessible label for ${mode}`);
  }
});
