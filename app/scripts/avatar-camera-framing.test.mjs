import assert from "node:assert/strict";
import test from "node:test";
import { resolveAvatarCameraFraming } from "../src/components/avatar/avatarCameraFraming.ts";

const bounds = {
  min: { x: -0.75, y: 0.04, z: -0.22 },
  max: { x: 0.75, y: 3.19, z: 0.22 },
};

test("camera fit centers the actual post-normalization bounds", () => {
  const fit = resolveAvatarCameraFraming(bounds, 31, 366 / 320);
  assert.ok(fit);
  assert.deepEqual(fit.center, { x: 0, y: 1.615, z: 0 });
  assert.ok(fit.distance > 5.5 && fit.distance < 8);
});

test("camera fit respects portrait viewports without cropping the horizontal span", () => {
  const portrait = resolveAvatarCameraFraming(bounds, 31, 0.4);
  const landscape = resolveAvatarCameraFraming(bounds, 31, 1.8);
  assert.ok(portrait && landscape);
  assert.ok(portrait.distance > landscape.distance);
  assert.ok(portrait.padding >= 1.05 && portrait.padding <= 1.6);
});

test("depth contributes to safe camera distance", () => {
  const deep = {
    min: { x: -0.2, y: 0, z: -2.2 },
    max: { x: 0.2, y: 1, z: 2.2 },
  };
  const fit = resolveAvatarCameraFraming(deep, 45, 1);
  assert.ok(fit);
  assert.ok(fit.distance > 2.2);
});

test("camera fit rejects invalid bounds and optical parameters", () => {
  assert.equal(resolveAvatarCameraFraming(null, 31, 1), null);
  assert.equal(resolveAvatarCameraFraming(bounds, 0, 1), null);
  assert.equal(resolveAvatarCameraFraming(bounds, 31, 0), null);
  assert.equal(resolveAvatarCameraFraming({
    min: { x: 1, y: 0, z: 0 },
    max: { x: -1, y: 2, z: 1 },
  }, 31, 1), null);
});

test("camera fit clamps excessive padding and avoids zero-distance bounds", () => {
  const point = { min: { x: 1, y: 1, z: 1 }, max: { x: 1, y: 1, z: 1 } };
  const fit = resolveAvatarCameraFraming(point, 31, 1, 99);
  assert.ok(fit);
  assert.equal(fit.padding, 1.6);
  assert.ok(fit.distance >= 0.15);
});
