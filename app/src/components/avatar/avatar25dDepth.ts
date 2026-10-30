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

  const cleanZero = (value: number): number => value === 0 ? 0 : value;
  return {
    rearHair: { x: cleanZero(-horizontal * 1.45 * scale), y: cleanZero(-vertical * 0.58 * scale) },
    torso: { x: cleanZero(horizontal * 0.42 * scale), y: cleanZero(vertical * 0.2 * scale) },
    head: { x: cleanZero(horizontal * 2.8 * scale), y: cleanZero(vertical * 1.45 * scale) },
    frontFringe: { x: cleanZero(horizontal * 0.8 * scale), y: cleanZero(vertical * 0.42 * scale) },
  };
}

function finiteRounded(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

export function svgTranslate(offset: DepthOffset): string {
  return `translate(${finiteRounded(offset.x)} ${finiteRounded(offset.y)})`;
}
