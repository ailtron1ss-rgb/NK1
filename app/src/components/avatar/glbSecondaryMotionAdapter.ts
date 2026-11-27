export interface GlbSecondaryMotionFrame {
  timeSeconds: number;
  awake: boolean;
  energy: number;
  action: string;
  bodyChannels?: Readonly<Record<string, number>>;
}

export interface GlbBoneRotationOffset {
  x: number;
  y: number;
  z: number;
}

const clamp01 = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const clampSigned = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const safeTime = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1e9, value)) : 0;
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Small, renderer-neutral secondary motion for the NK1 Kurisu GLB rig.
 * Values are additive radians, deliberately bounded and deterministic for a
 * given monotonic time sample. The caller resets each bone to its bind/mixer
 * pose before applying this offset, so the motion never accumulates.
 */
export function resolveGlbSecondaryBoneRotation(
  boneName: string,
  frame: GlbSecondaryMotionFrame,
): GlbBoneRotationOffset | null {
  if (typeof boneName !== "string" || !boneName.trim() || !frame) return null;
  const name = normalize(boneName);
  const t = safeTime(frame.timeSeconds);
  const channels = frame.bodyChannels ?? {};
  const energy = clamp01(frame.energy);
  const awakeScale = frame.awake === true ? 1 : 0.28;
  const actionScale = frame.action === "walk" || frame.action === "explore" ? 1.18 : 1;
  const sway = awakeScale * (0.52 + energy * 0.48) * actionScale;

  if (name.startsWith("hairfringe") || name.startsWith("hairlock") || name.startsWith("hairSide".toLowerCase())) {
    const isTip = name.includes("tip");
    const phase = Array.from(name).reduce((sum, char) => (sum + char.charCodeAt(0) * 0.017) % (Math.PI * 2), 0);
    const base = isTip ? 0.032 : 0.018;
    const wave = Math.sin(t * 1.18 + phase);
    const counterWave = Math.sin(t * 0.83 + phase + 1.25);
    return {
      x: wave * base * sway,
      y: counterWave * base * 0.16 * sway,
      z: counterWave * base * 0.42 * sway,
    };
  }

  const side = name.startsWith("left") ? "left" : name.startsWith("right") ? "right" : null;
  if (!side) return null;

  const digits = ["thumb", "index", "middle", "ring", "little"];
  const digit = digits.find((candidate) => name.startsWith(side + candidate));
  if (digit) {
    const aggregateKey = side === "left" ? "leftFingers" : "rightFingers";
    const digitKey = `${side}${digit[0].toUpperCase()}${digit.slice(1)}Curl`;
    const perDigit = channels[digitKey];
    // An explicit per-digit value, including zero, takes precedence over the
    // legacy aggregate curl. Negative values extend; positive values flex.
    const curl = typeof perDigit === "number" && Number.isFinite(perDigit)
      ? clampSigned(perDigit)
      : clamp01(channels[aggregateKey]);
    const factor: Record<string, number> = { thumb: 0.72, index: 0.88, middle: 1, ring: 0.96, little: 0.82 };
    const distal = name.endsWith("tip");
    const magnitude = (distal ? 0.58 : 0.14) * factor[digit] * curl;
    return { x: -magnitude, y: 0, z: 0 };
  }

  if (name === "lefttoe" || name === "righttoe") {
    const ankle = clampSigned(channels[side === "left" ? "leftAnkle" : "rightAnkle"]);
    const locomotionScale = frame.action === "walk" || frame.action === "explore" ? 1 : 0.45;
    return { x: ankle * 0.22 * locomotionScale, y: 0, z: 0 };
  }

  return null;
}
