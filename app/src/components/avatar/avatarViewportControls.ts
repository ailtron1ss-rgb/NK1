export const AVATAR_CAMERA_DEFAULT_DISTANCE = 6.65;
export const AVATAR_CAMERA_MIN_DISTANCE = 2.4;
export const AVATAR_CAMERA_MAX_DISTANCE = 9;

/**
 * Resolve a bounded dolly distance for the 3D avatar viewport.
 * Positive delta moves the camera away; negative delta moves it closer.
 * Invalid values are treated as a request to return to the known default.
 */
export function resolveAvatarCameraDistance(
  currentDistance: number,
  delta: number,
): number {
  const current = Number.isFinite(currentDistance)
    ? currentDistance
    : AVATAR_CAMERA_DEFAULT_DISTANCE;
  const change = Number.isFinite(delta) ? delta : 0;

  return Math.max(
    AVATAR_CAMERA_MIN_DISTANCE,
    Math.min(AVATAR_CAMERA_MAX_DISTANCE, current + change),
  );
}

export interface AvatarCameraFitSize {
  x: number;
  y: number;
  z: number;
}

/**
 * Fit a character-only bounding box inside the active perspective viewport.
 * The function is pure so camera framing can be verified without WebGL.
 * Invalid geometry or projection values fail closed to the stable default.
 */
export function resolveAvatarCameraFitDistance(
  size: AvatarCameraFitSize,
  fovDegrees: number,
  aspect: number,
  padding = 1.14,
): number {
  const dimensions = [size?.x, size?.y, size?.z];
  if (!dimensions.every((value) => Number.isFinite(value) && value >= 0)
    || !dimensions.some((value) => value > 1e-4)
    || !Number.isFinite(fovDegrees) || fovDegrees <= 1 || fovDegrees >= 120
    || !Number.isFinite(aspect) || aspect <= 0
    || !Number.isFinite(padding) || padding < 1 || padding > 2) {
    return AVATAR_CAMERA_DEFAULT_DISTANCE;
  }

  const verticalHalfFov = fovDegrees * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const verticalDistance = size.y / (2 * Math.tan(verticalHalfFov));
  const horizontalDistance = size.x / (2 * Math.tan(horizontalHalfFov));
  const depthClearance = size.z / 2;
  const required = (Math.max(verticalDistance, horizontalDistance) + depthClearance) * padding;

  if (!Number.isFinite(required)) return AVATAR_CAMERA_DEFAULT_DISTANCE;
  return Math.max(
    AVATAR_CAMERA_MIN_DISTANCE,
    Math.min(AVATAR_CAMERA_MAX_DISTANCE, required),
  );
}
