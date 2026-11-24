import type { AvatarBrainEnvelopeV1, AvatarBrainProjectionV1 } from "@/organism/types";
import type { BodyChannel } from "./embodimentSwitch";
import { CLOSED_MOUTH, type MouthPose } from "./embodimentTimeline";

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

/** Only use a frame published for the same canonical organism tick as the UI snapshot. */
export function avatarBrainFrameForTick(
  envelope: AvatarBrainEnvelopeV1 | null | undefined,
  tick: number,
): AvatarBrainProjectionV1 | null {
  if (!envelope || envelope.schemaVersion !== 1 || !Number.isSafeInteger(tick)
    || envelope.stateVersion !== tick || envelope.frame?.schemaVersion !== 1
    || envelope.frame.source !== "organism-state") return null;
  return envelope.frame;
}

/** Translate the canonical affect expression vocabulary into names supported by the Cubism viewer. */
export function avatarBrainLive2DExpression(frame: AvatarBrainProjectionV1): string {
  if (frame.expressionWeight < 0.12) return "neutral";
  const expressionMap: Record<AvatarBrainProjectionV1["expression"], string> = {
    neutral: "neutral",
    curious: "thinking",
    focused: "focused",
    amused: "happy",
    concerned: "sad",
    tired: "tired",
    determined: "focused",
  };
  return expressionMap[frame.expression];
}

/** Cubism gaze inputs are intentionally narrower than the normalized cross-renderer channels. */
export function avatarBrainGaze(
  frame: AvatarBrainProjectionV1 | null,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!frame) return { x: clamp(fallback.x, -0.4, 0.4), y: clamp(fallback.y, -0.4, 0.4) };
  return {
    x: clamp(frame.channels.gazeX * 0.4, -0.4, 0.4),
    y: clamp(frame.channels.gazeY * 0.4, -0.4, 0.4),
  };
}

/** Convert the normalized head tilt into the small radian-like range expected by the Live2D intent contract. */
export function avatarBrainHeadTilt(frame: AvatarBrainProjectionV1 | null, fallback: number): number {
  return frame ? clamp(frame.channels.headTilt * 0.15, -0.15, 0.15) : fallback;
}

/** Keep audio visemes authoritative while the canonical brain projection supplies a bounded gain. */
export function avatarBrainMouthPose(
  pose: MouthPose,
  frame: AvatarBrainProjectionV1 | null,
  speaking: boolean,
): MouthPose {
  if (!speaking) return CLOSED_MOUTH;
  const gain = frame ? clamp(frame.channels.lipSyncGain, 0, 1) : 1;
  return {
    ...pose,
    open: clamp(pose.open, 0, 1) * gain,
    form: clamp(pose.form, -1, 1),
  };
}

/** Shared frame channels mapped to the neutral body vocabulary; renderers still decide how to apply them. */
export function avatarBrainBodyChannels(
  frame: AvatarBrainProjectionV1 | null,
): Partial<Record<BodyChannel, number>> {
  if (!frame) return {};
  const channels = frame.channels;
  return {
    headRoll: channels.headTilt,
    headYaw: channels.headYaw,
    gazeX: channels.gazeX,
    gazeY: channels.gazeY,
    breath: channels.idleMotion,
  };
}
