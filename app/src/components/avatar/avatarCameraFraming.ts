export interface AvatarCameraBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface AvatarCameraFraming {
  center: { x: number; y: number; z: number };
  distance: number;
  padding: number;
  verticalFovDegrees: number;
  horizontalFovDegrees: number;
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Calculates a safe perspective-camera position for an already-transformed
 * avatar. The vertical and horizontal spans are fitted independently so
 * portrait canvases do not crop side geometry or the hair silhouette.
 */
export function resolveAvatarCameraFraming(
  bounds: AvatarCameraBounds | null | undefined,
  verticalFovDegrees: number,
  aspect: number,
  padding = 1.18,
): AvatarCameraFraming | null {
  if (!bounds || !finite(verticalFovDegrees) || verticalFovDegrees <= 1 || verticalFovDegrees >= 179
    || !finite(aspect) || aspect <= 0
    || !finite(padding)) return null;

  const coordinates = [
    bounds.min?.x, bounds.min?.y, bounds.min?.z,
    bounds.max?.x, bounds.max?.y, bounds.max?.z,
  ];
  if (!coordinates.every(finite)) return null;
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;
  if (width < 0 || height < 0 || depth < 0) return null;

  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const verticalFov = verticalFovDegrees * Math.PI / 180;
  const verticalHalfFov = verticalFov / 2;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const horizontalFov = horizontalHalfFov * 2;
  const safePadding = clamp(padding, 1.05, 1.6);

  const verticalDistance = height / (2 * Math.tan(verticalHalfFov));
  const horizontalDistance = width / (2 * Math.tan(horizontalHalfFov));
  const depthDistance = depth / 2;
  const minimumDistance = 0.05;
  const distance = (Math.max(verticalDistance, horizontalDistance, depthDistance, minimumDistance) + 0.1)
    * safePadding;

  if (!Number.isFinite(distance) || distance <= 0) return null;
  return {
    center,
    distance,
    padding: safePadding,
    verticalFovDegrees,
    horizontalFovDegrees: horizontalFov * 180 / Math.PI,
  };
}
