export interface DepthOffset {
  x: number;
  y: number;
}

export interface Avatar25DDepthOffsets {
  rearHair: DepthOffset;
  torso: DepthOffset;
  head: DepthOffset;
  frontFringe: DepthOffset;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/**
 * Differential parallax for the editable SVG concept rig. Values are in
 * SVG viewBox units, not CSS pixels. Each layer gets a distinct depth gain;
 * no raster image is split or fabricated into fake anatomical layers.
 */
export function deriveAvatar25DDepthOffsets(
  gazeX: number,
  gazeY: number,
  motionScale = 1,
): Avatar25DDepthOffsets {
  const horizontal = clamp(gazeX / 0.4, -1, 1);
  const vertical = clamp(gazeY / 0.4, -1, 1);
  const scale = clamp(motionScale, 0, 1.5);

  return {
    rearHair: { x: -horizontal * 1.45 * scale, y: -vertical * 0.58 * scale },
    torso: { x: horizontal * 0.42 * scale, y: vertical * 0.2 * scale },
    head: { x: horizontal * 2.8 * scale, y: vertical * 1.45 * scale },
    frontFringe: { x: horizontal * 0.8 * scale, y: vertical * 0.42 * scale },
  };
}

export function svgTranslate(offset: DepthOffset): string {
  return `translate(${Number(offset.x.toFixed(3))} ${Number(offset.y.toFixed(3))})`;
}
