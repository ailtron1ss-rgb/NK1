import type { BodyChannel } from "./embodimentSwitch.ts";

export interface GlbBodyBoneRotation {
  x: number;
  y: number;
  z: number;
}

const ZERO: GlbBodyBoneRotation = { x: 0, y: 0, z: 0 };
const unit = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const signal = (channels: Readonly<Partial<Record<BodyChannel, number>>>, key: BodyChannel, scale: number): number =>
  unit(channels[key]) * scale;

/**
 * Resolve one normalized GLB node name to a bounded local rotation.
 *
 * This is the non-VRM GLB path: it uses the same renderer-neutral particle
 * body channels as VRM, but maps them onto explicitly recognized humanoid
 * joint names. Unknown nodes are left untouched rather than guessed.
 */
export function resolveGlbBodyBoneRotation(
  rawName: string,
  channels: Readonly<Partial<Record<BodyChannel, number>>>,
): GlbBodyBoneRotation {
  const name = String(rawName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!name || !channels || typeof channels !== "object") return { ...ZERO };

  if (name.includes("head")) {
    return {
      x: signal(channels, "headPitch", 0.22),
      y: signal(channels, "headYaw", 0.28),
      z: signal(channels, "headRoll", 0.24),
    };
  }
  if (name.includes("neck")) {
    return {
      x: signal(channels, "torsoPitch", 0.1) + signal(channels, "headPitch", 0.08),
      y: signal(channels, "torsoYaw", 0.05) + signal(channels, "headYaw", 0.12),
      z: signal(channels, "headRoll", 0.08),
    };
  }
  if (name === "hips" || name.endsWith("hips") || name.includes("pelvis")) {
    return { x: 0, y: signal(channels, "rootYaw", 0.3), z: 0 };
  }
  if (name.includes("spine") || name.includes("chest") || name.includes("torso")) {
    return {
      x: signal(channels, "torsoPitch", 0.22),
      y: signal(channels, "torsoYaw", 0.24),
      z: 0,
    };
  }

  const left = name.includes("left");
  const right = name.includes("right");
  if (!left && !right) return { ...ZERO };
  const side = left ? "left" : "right";

  if (/thumb|index|middle|ring|little/.test(name) && /finger|thumb|index|middle|ring|little/.test(name)) {
    const digit = name.includes("thumb") ? "ThumbCurl"
      : name.includes("index") ? "IndexCurl"
        : name.includes("middle") ? "MiddleCurl"
          : name.includes("ring") ? "RingCurl" : "LittleCurl";
    const channel = (side + digit) as BodyChannel;
    const aggregate = (side + "Fingers") as BodyChannel;
    const curl = channels[channel] === undefined
      ? signal(channels, aggregate, 0.28)
      : signal(channels, channel, 0.42);
    return { x: curl, y: 0, z: 0 };
  }
  if (name.includes("upperarm") || name.includes("shoulder")) {
    const channel = (side + "Shoulder") as BodyChannel;
    return { x: 0, y: 0, z: signal(channels, channel, 0.48) };
  }
  if (name.includes("lowerarm") || name.includes("forearm") || name.includes("elbow")) {
    const channel = (side + "Elbow") as BodyChannel;
    return { x: 0, y: 0, z: signal(channels, channel, 0.54) };
  }
  if (name.includes("hand")) {
    const wrist = (side + "Wrist") as BodyChannel;
    const hand = (side + "Hand") as BodyChannel;
    return { x: signal(channels, wrist, 0.3), y: signal(channels, hand, 0.28), z: 0 };
  }
  if (name.includes("upperleg") || name.includes("thigh")) {
    const channel = (side + "Hip") as BodyChannel;
    return { x: 0, y: 0, z: signal(channels, channel, 0.46) };
  }
  if (name.includes("lowerleg") || name.includes("calf") || name.includes("shin")) {
    const channel = (side + "Knee") as BodyChannel;
    return { x: 0, y: 0, z: signal(channels, channel, 0.5) };
  }
  if (name.includes("foot") || name.includes("ankle")) {
    const channel = (side + "Ankle") as BodyChannel;
    return { x: signal(channels, channel, 0.3), y: 0, z: 0 };
  }
  return { ...ZERO };
}
