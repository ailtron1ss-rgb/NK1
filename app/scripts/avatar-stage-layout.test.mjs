import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { avatarRendererPresentation } from "../src/components/avatar/avatarRendererPresentation.ts";

const stagePath = new URL("../src/components/AvatarStage.tsx", import.meta.url);

test("renderer presentation is sourced from the registry and describes actual rig types", () => {
  const live2d = avatarRendererPresentation("live2d");
  const original = avatarRendererPresentation("original");
  const legacy = avatarRendererPresentation("legacy");
  const threeD = avatarRendererPresentation("3d");

  assert.equal(live2d.rigClass, "cubism-deform");
  assert.equal(live2d.selectable, true);
  assert.match(live2d.description, /Cubism.*2D-тело/);
  assert.equal(original.rigClass, "vector-driven");
  assert.match(original.description, /не полноценный скелетный риг/);
  assert.equal(legacy.rigClass, "static-poses");
  assert.match(legacy.description, /PNG-позы без деформируемого рига/);
  assert.equal(threeD.rigClass, "humanoid-skeleton");
  assert.equal(threeD.previewOnly, true);
  assert.equal(threeD.selectable, false);
  assert.match(threeD.ariaLabel, /предпросмотр, не прошедший приёмку/);
});

test("mode controls are a named toolbar with pressed state and mobile-sized targets", async () => {
  const stage = await readFile(stagePath, "utf8");
  assert.match(stage, /role="toolbar" aria-label="Управление аватаром"/);
  assert.match(stage, /role="group" aria-label="Режим отображения персонажа"/);
  assert.match(stage, /role="status" aria-live="polite" aria-label="Тип выбранного тела"/);
  for (const mode of ["live2d", "legacy", "original", "3d"]) {
    const pressed = `aria-pressed={mode === "${mode}"}`;
    const pressedAt = stage.indexOf(pressed);
    assert.notEqual(pressedAt, -1, "missing selected state for " + mode);
    const buttonStart = stage.lastIndexOf("<button", pressedAt);
    const buttonEnd = stage.indexOf("</button>", pressedAt);
    assert.ok(stage.slice(buttonStart, buttonEnd).includes("min-h-11"), mode + " control must have a 44px minimum hit target");
  }
  assert.match(stage, /focus-visible:ring-2/);
  assert.doesNotMatch(stage, /absolute left-3 top-3/, "toolbar must not obscure the avatar hit surface");
  assert.match(stage, /aria-label="Включить или выключить голос Курису"/);
});

test("UI exposes truthful Russian descriptions and does not offer unbuilt 2.5D as a mode", async () => {
  const stage = await readFile(stagePath, "utf8");
  const presentation = await readFile(new URL("../src/components/avatar/avatarRendererPresentation.ts", import.meta.url), "utf8");
  for (const phrase of [
    "Cubism · деформируемое 2D-тело",
    "Статичные спрайты",
    "SVG-вектор · ограниченная 2D-анимация",
    "кандидат для предпросмотра, не прошедший приёмку для выпуска",
    "Модель Live2D недоступна",
    "Открыть Legacy",
    "Бодрствует",
    "Спит",
    "Провайдер речи Termux:",
  ]) assert.ok(stage.includes(phrase) || presentation.includes(phrase), "missing user-visible copy: " + phrase);
  assert.doesNotMatch(stage, /setMode\("depth2d"\)|aria-label="Выбрать 2\.5D/, "2.5D remains hidden until its asset pack is accepted");
});
