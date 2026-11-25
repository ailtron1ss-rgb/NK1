export type OriginalStageContactZone = "head" | "body";

export interface OriginalStageContactPoint {
  zone: OriginalStageContactZone;
  nx: number;
  ny: number;
}

/**
 * Map normalized coordinates inside the SVG viewBox to the same bounded
 * head/body contact protocol used by Live2D, Legacy and 3D.
 *
 * The authored face occupies y=39..185 in a 0..560 viewBox. A normalized
 * cutoff at 185/560 keeps the hit target aligned with the actual illustration.
 */
export function resolveOriginalStageContactPoint(
  nx: number,
  ny: number,
): OriginalStageContactPoint | null {
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return {
    zone: ny <= 185 / 560 ? "head" : "body",
    nx,
    ny,
  };
}
