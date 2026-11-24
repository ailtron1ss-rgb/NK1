export const AVATAR_CAMERA_DEFAULT_DISTANCE = 6.65;
export const AVATAR_CAMERA_MIN_DISTANCE = 4.5;
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
