import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_CAMERA_DEFAULT_DISTANCE,
  AVATAR_CAMERA_MAX_DISTANCE,
  AVATAR_CAMERA_MIN_DISTANCE,
  resolveAvatarCameraFitDistance,
} from "../src/components/avatar/avatarViewportControls.ts";

test("3D camera fit frames a compact avatar more closely than a full-height model", () => {
  const compactMobileModel = resolveAvatarCameraFitDistance(
    { x: 0.84, y: 1.07, z: 0.84 },
    31,
    280 / 420,
  );
  const fullHeightModel = resolveAvatarCameraFitDistance(
    { x: 0.84, y: 3.15, z: 0.84 },
    31,
    280 / 420,
  );

  assert.ok(compactMobileModel >= AVATAR_CAMERA_MIN_DISTANCE);
  assert.ok(fullHeightModel > compactMobileModel,
    "the camera must move back for a taller avatar instead of leaving short models tiny");
  assert.ok(fullHeightModel <= AVATAR_CAMERA_MAX_DISTANCE,
    "the fitted view must remain inside the bounded camera range");
});

test("3D camera fit respects viewport aspect ratio and leaves padding around the model", () => {
  const narrow = resolveAvatarCameraFitDistance({ x: 2, y: 2, z: 0.3 }, 31, 0.6);
  const wide = resolveAvatarCameraFitDistance({ x: 2, y: 2, z: 0.3 }, 31, 1.8);

  assert.ok(narrow > wide,
    "a narrow mobile viewport needs more camera distance for the same model width");
  assert.ok(wide > AVATAR_CAMERA_MIN_DISTANCE);
});

test("invalid model bounds or camera parameters fail closed to the default distance", () => {
  assert.equal(
    resolveAvatarCameraFitDistance({ x: 0, y: 0, z: 0 }, 31, 1),
    AVATAR_CAMERA_DEFAULT_DISTANCE,
  );
  assert.equal(
    resolveAvatarCameraFitDistance({ x: 1, y: Number.NaN, z: 1 }, 31, 1),
    AVATAR_CAMERA_DEFAULT_DISTANCE,
  );
  assert.equal(
    resolveAvatarCameraFitDistance({ x: 1, y: 2, z: 1 }, Number.NaN, 1),
    AVATAR_CAMERA_DEFAULT_DISTANCE,
  );
});
