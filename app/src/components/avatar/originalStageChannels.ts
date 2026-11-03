import type { BodyChannel } from "./embodimentSwitch";

export type BodyChannels = Partial<Record<BodyChannel, number>>;

const clampChannel = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
};

const channelValue = (channels: BodyChannels | undefined, channel: BodyChannel): number =>
  clampChannel(channels?.[channel]);

export interface OriginalStageChannelOffsets {
  torsoOffsetX: number;
  torsoOffsetY: number;
  headOffsetX: number;
  headOffsetY: number;
  headRollDeg: number;
  breathScale: number;
}

/**
 * Map renderer-neutral arbiter channels onto the flat SVG rig. A 2D layer cannot
 * rotate joints, so yaw/pitch become translation and roll becomes rotation; this
 * keeps one channel vocabulary across 2D, 2.5D and 3D. Pure and bounded.
 */
export function originalStageChannelOffsets(channels?: BodyChannels): OriginalStageChannelOffsets {
  return {
    torsoOffsetX: channelValue(channels, "torsoYaw") * 8,
    torsoOffsetY: channelValue(channels, "torsoPitch") * 6,
    headOffsetX: channelValue(channels, "headYaw") * 7,
    headOffsetY: channelValue(channels, "headPitch") * 5,
    headRollDeg: channelValue(channels, "headRoll") * 7,
    breathScale: 1 + channelValue(channels, "breath") * 0.015,
  };
}
