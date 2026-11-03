/**
 * NK1 motion library: named, bounded whole-body motion programs (aspect 11 / motor).
 *
 * A motion program is a deterministic, keyframed description of a body movement
 * expressed in normalized body channels. It is renderer-neutral: adapters scale
 * and map channels into their own rig. Programs deliberately avoid the
 * "one emotion = one clip" anti-pattern by composing a small set of reusable
 * movements (breath, lean, head turn, arm gesture, weight shift) and blending
 * them per intent.
 *
 * This module computes target channel values only. It never claims a renderer
 * applied or displayed them; an adapter must verify that separately.
 */
import type { BodyChannel } from "./embodimentSwitch.ts";

/** Motion programs available to the body. Extend by adding a program, not a branch. */
export type MotionProgramId =
  | "idle" | "listen" | "think" | "explain" | "comfort" | "surprised"
  | "concern" | "respond" | "walk" | "turn" | "sit" | "stand" | "reach" | "point" | "wave" | "hold";

export interface MotionKeyframe {
  /** Normalized time within the program, 0..1 inclusive and strictly increasing. */
  t: number;
  channels: Partial<Record<BodyChannel, number>>;
}

export interface MotionProgram {
  id: MotionProgramId;
  /** Base loop length in milliseconds; a `loop: false` program holds its last frame. */
  durationMs: number;
  loop: boolean;
  keyframes: readonly MotionKeyframe[];
}

export interface MotionSample {
  programId: MotionProgramId;
  /** Monotonic program-local time in ms (wrapped for looping programs). */
  timeMs: number;
  /** Interpolated channel targets; adapters clamp to their own limits. */
  channels: Partial<Record<BodyChannel, number>>;
}

export interface MotionBlendResult {
  channels: Partial<Record<BodyChannel, number>>;
  /** Channels contributed by more than one program; useful for diagnostics. */
  blendedChannels: BodyChannel[];
}

export interface MotionProgramIssue {
  code: string;
  message: string;
}

const MAX_DURATION_MS = 20_000;
const BODY_CHANNELS: ReadonlySet<BodyChannel> = new Set([
  "headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch",
  "leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist",
  "leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle",
  "leftHand", "rightHand", "leftFingers", "rightFingers", "gazeX", "gazeY", "breath", "rootYaw",
]);

export function validateMotionProgram(program: MotionProgram): MotionProgramIssue[] {
  const issues: MotionProgramIssue[] = [];
  if (!program || typeof program !== "object") return [{ code: "invalid-program", message: "program must be an object" }];
  if (typeof program.id !== "string" || !program.id.trim()) issues.push({ code: "invalid-id", message: "id must be non-blank" });
  if (!Number.isFinite(program.durationMs) || program.durationMs <= 0 || program.durationMs > MAX_DURATION_MS) {
    issues.push({ code: "invalid-duration", message: `durationMs must be in (0, ${MAX_DURATION_MS}]` });
  }
  if (typeof program.loop !== "boolean") issues.push({ code: "invalid-loop", message: "loop must be boolean" });
  if (!Array.isArray(program.keyframes) || program.keyframes.length < 2) {
    issues.push({ code: "insufficient-keyframes", message: "at least two keyframes are required" });
    return issues;
  }
  let previousT = -1;
  for (const [index, frame] of program.keyframes.entries()) {
    if (!frame || !Number.isFinite(frame.t) || frame.t < 0 || frame.t > 1) {
      issues.push({ code: "invalid-keyframe-time", message: `keyframe ${index} has an out-of-range t` });
      continue;
    }
    if (frame.t <= previousT) issues.push({ code: "non-increasing-keyframe", message: `keyframe ${index} t must strictly increase` });
    previousT = frame.t;
    for (const [channel, value] of Object.entries(frame.channels)) {
      if (!BODY_CHANNELS.has(channel as BodyChannel) || !Number.isFinite(value) || Math.abs(value as number) > 1) {
        issues.push({ code: "invalid-channel-value", message: `keyframe ${index} channel ${channel} is invalid or unbounded` });
      }
    }
  }
  if (program.keyframes[0]!.t !== 0) issues.push({ code: "missing-start-keyframe", message: "first keyframe must start at t=0" });
  if (program.keyframes[program.keyframes.length - 1]!.t !== 1) issues.push({ code: "missing-end-keyframe", message: "last keyframe must end at t=1" });
  if (program.loop) {
    const first = program.keyframes[0]!.channels;
    const last = program.keyframes[program.keyframes.length - 1]!.channels;
    for (const channel of new Set([...Object.keys(first), ...Object.keys(last)])) {
      if ((first[channel as BodyChannel] ?? 0) !== (last[channel as BodyChannel] ?? 0)) {
        issues.push({ code: "loop-seam-mismatch", message: `looping program must start and end at the same value for ${channel}` });
      }
    }
  }
  return issues;
}

const clampUnit = (value: number): number =>
  Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

/** Sample a program at a monotonic program-local time, interpolating between keyframes. */
export function sampleMotionProgram(program: MotionProgram, timeMs: number): MotionSample {
  const issues = validateMotionProgram(program);
  if (issues.length) throw new TypeError(`invalid-motion-program:${issues.map((issue) => issue.code).join(",")}`);
  const safeTime = Number.isFinite(timeMs) && timeMs >= 0 ? timeMs : 0;
  const wrapped = program.loop ? safeTime % program.durationMs : Math.min(safeTime, program.durationMs);
  const u = wrapped / program.durationMs;
  const frames = program.keyframes;
  let upperIndex = frames.findIndex((frame) => frame.t >= u);
  if (upperIndex <= 0) {
    const only = frames[upperIndex < 0 ? frames.length - 1 : 0]!;
    return { programId: program.id, timeMs: wrapped, channels: { ...only.channels } };
  }
  const lower = frames[upperIndex - 1]!;
  const upper = frames[upperIndex]!;
  const span = upper.t - lower.t;
  const localT = span <= 0 ? 0 : (u - lower.t) / span;
  const channels: Partial<Record<BodyChannel, number>> = {};
  for (const channel of new Set([...Object.keys(lower.channels), ...Object.keys(upper.channels)]) as Set<BodyChannel>) {
    const a = lower.channels[channel] ?? 0;
    const b = upper.channels[channel] ?? 0;
    channels[channel] = clampUnit(a + (b - a) * localT);
  }
  return { programId: program.id, timeMs: wrapped, channels };
}

export interface MotionBlendLayer {
  program: MotionProgram;
  /** Monotonic program-local time for this layer. */
  timeMs: number;
  /** Non-negative weight; layers are normalized, so weights need not sum to 1. */
  weight: number;
}

/**
 * Weighted blend of several motion layers. Only channels present in at least one
 * layer are emitted. Weights are clamped and normalized; an all-zero weight set
 * yields an empty pose rather than an arbitrary default.
 */
export function blendMotionLayers(layers: readonly MotionBlendLayer[]): MotionBlendResult {
  const acc = new Map<BodyChannel, number>();
  const seen = new Map<BodyChannel, number>();
  let totalWeight = 0;
  for (const layer of layers) {
    if (!layer || !layer.program) continue;
    const weight = Number.isFinite(layer.weight) && layer.weight > 0 ? layer.weight : 0;
    if (weight <= 0) continue;
    totalWeight += weight;
    const sample = sampleMotionProgram(layer.program, layer.timeMs);
    for (const [channel, value] of Object.entries(sample.channels) as [BodyChannel, number][]) {
      acc.set(channel, (acc.get(channel) ?? 0) + value * weight);
      seen.set(channel, (seen.get(channel) ?? 0) + 1);
    }
  }
  const channels: Partial<Record<BodyChannel, number>> = {};
  const blendedChannels: BodyChannel[] = [];
  if (totalWeight > 0) {
    for (const [channel, sum] of acc) {
      channels[channel] = clampUnit(sum / totalWeight);
      if ((seen.get(channel) ?? 0) > 1) blendedChannels.push(channel);
    }
  }
  return { channels, blendedChannels };
}

const kf = (t: number, channels: Partial<Record<BodyChannel, number>>): MotionKeyframe => ({ t, channels });

/**
 * Canonical program set. Each program is intentionally short and composable;
 * emotional colour comes from blending and from the affect-driven channels, not
 * from a distinct clip per emotion.
 */
export const MOTION_PROGRAMS: Readonly<Record<MotionProgramId, MotionProgram>> = Object.freeze({
  idle: {
    id: "idle", durationMs: 4200, loop: true,
    keyframes: [kf(0, { breath: 0.1, torsoPitch: 0 }), kf(0.5, { breath: 0.9, torsoPitch: 0.02 }), kf(1, { breath: 0.1, torsoPitch: 0 })],
  },
  listen: {
    id: "listen", durationMs: 3600, loop: true,
    keyframes: [kf(0, { headPitch: -0.06, headYaw: 0, gazeX: 0 }), kf(0.5, { headPitch: -0.1, headYaw: 0.05, gazeX: 0.1 }), kf(1, { headPitch: -0.06, headYaw: 0, gazeX: 0 })],
  },
  think: {
    id: "think", durationMs: 3000, loop: true,
    keyframes: [kf(0, { headPitch: 0.08, headRoll: -0.04, rightShoulder: 0.25, rightElbow: 0.4, gazeX: -0.15 }), kf(0.5, { headPitch: 0.12, headRoll: -0.06, rightShoulder: 0.3, rightElbow: 0.5, gazeX: -0.25 }), kf(1, { headPitch: 0.08, headRoll: -0.04, rightShoulder: 0.25, rightElbow: 0.4, gazeX: -0.15 })],
  },
  explain: {
    id: "explain", durationMs: 2400, loop: true,
    keyframes: [kf(0, { headYaw: -0.05, rightShoulder: -0.2, rightElbow: 0.3, leftShoulder: 0.1 }), kf(0.35, { headYaw: 0.08, rightShoulder: -0.34, rightElbow: 0.5, leftShoulder: 0.18 }), kf(0.7, { headYaw: -0.03, rightShoulder: -0.24, rightElbow: 0.36, leftShoulder: 0.12 }), kf(1, { headYaw: -0.05, rightShoulder: -0.2, rightElbow: 0.3, leftShoulder: 0.1 })],
  },
  comfort: {
    id: "comfort", durationMs: 3600, loop: true,
    keyframes: [kf(0, { headPitch: 0.05, headRoll: 0.06, leftShoulder: -0.18, rightShoulder: -0.18 }), kf(0.5, { headPitch: 0.08, headRoll: 0.08, leftShoulder: -0.24, rightShoulder: -0.24 }), kf(1, { headPitch: 0.05, headRoll: 0.06, leftShoulder: -0.18, rightShoulder: -0.18 })],
  },
  surprised: {
    id: "surprised", durationMs: 1200, loop: false,
    keyframes: [kf(0, { headPitch: 0, torsoPitch: 0 }), kf(0.25, { headPitch: -0.16, torsoPitch: -0.08, leftShoulder: -0.3, rightShoulder: -0.3 }), kf(1, { headPitch: -0.04, torsoPitch: -0.02, leftShoulder: -0.05, rightShoulder: -0.05 })],
  },
  concern: {
    id: "concern", durationMs: 3000, loop: true,
    keyframes: [kf(0, { headRoll: 0.05, headPitch: 0.04, leftShoulder: -0.08, rightShoulder: -0.08 }), kf(0.5, { headRoll: 0.07, headPitch: 0.06, leftShoulder: -0.12, rightShoulder: -0.12 }), kf(1, { headRoll: 0.05, headPitch: 0.04, leftShoulder: -0.08, rightShoulder: -0.08 })],
  },
  respond: {
    id: "respond", durationMs: 2600, loop: true,
    keyframes: [kf(0, { headPitch: -0.02, rightShoulder: -0.12, rightElbow: 0.2 }), kf(0.5, { headPitch: -0.05, rightShoulder: -0.22, rightElbow: 0.34 }), kf(1, { headPitch: -0.02, rightShoulder: -0.12, rightElbow: 0.2 })],
  },
  walk: {
    id: "walk", durationMs: 1400, loop: true,
    keyframes: [kf(0, { leftHip: -0.3, rightHip: 0.3, leftKnee: 0.15, rightKnee: -0.05, leftShoulder: 0.2, rightShoulder: -0.2, torsoPitch: 0.03 }), kf(0.5, { leftHip: 0.3, rightHip: -0.3, leftKnee: -0.05, rightKnee: 0.15, leftShoulder: -0.2, rightShoulder: 0.2, torsoPitch: 0.03 }), kf(1, { leftHip: -0.3, rightHip: 0.3, leftKnee: 0.15, rightKnee: -0.05, leftShoulder: 0.2, rightShoulder: -0.2, torsoPitch: 0.03 })],
  },
  turn: {
    id: "turn", durationMs: 1600, loop: false,
    keyframes: [kf(0, { rootYaw: 0 }), kf(1, { rootYaw: 0.9 })],
  },
  sit: {
    id: "sit", durationMs: 1800, loop: false,
    keyframes: [kf(0, { leftHip: 0, rightHip: 0, leftKnee: 0, rightKnee: 0, torsoPitch: 0 }), kf(1, { leftHip: 0.8, rightHip: 0.8, leftKnee: 0.9, rightKnee: 0.9, torsoPitch: 0.12 })],
  },
  stand: {
    id: "stand", durationMs: 1800, loop: false,
    keyframes: [kf(0, { leftHip: 0.8, rightHip: 0.8, leftKnee: 0.9, rightKnee: 0.9, torsoPitch: 0.12 }), kf(1, { leftHip: 0, rightHip: 0, leftKnee: 0, rightKnee: 0, torsoPitch: 0 })],
  },
  reach: {
    id: "reach", durationMs: 1600, loop: false,
    keyframes: [kf(0, { rightShoulder: 0, rightElbow: 0, rightWrist: 0 }), kf(1, { rightShoulder: -0.5, rightElbow: 0.7, rightWrist: 0.2 })],
  },
  point: {
    id: "point", durationMs: 1600, loop: false,
    keyframes: [kf(0, { rightShoulder: 0, rightElbow: 0, rightHand: 0 }), kf(1, { rightShoulder: -0.45, rightElbow: 0.2, rightHand: 0.6 })],
  },
  wave: {
    id: "wave", durationMs: 1200, loop: true,
    keyframes: [kf(0, { rightShoulder: -0.6, rightElbow: 0.5, rightHand: 0.2 }), kf(0.5, { rightShoulder: -0.6, rightElbow: 0.5, rightHand: -0.2 }), kf(1, { rightShoulder: -0.6, rightElbow: 0.5, rightHand: 0.2 })],
  },
  hold: {
    id: "hold", durationMs: 2000, loop: true,
    keyframes: [kf(0, { rightShoulder: -0.3, rightElbow: 0.6, rightHand: 0.3 }), kf(0.5, { rightShoulder: -0.32, rightElbow: 0.62, rightHand: 0.32 }), kf(1, { rightShoulder: -0.3, rightElbow: 0.6, rightHand: 0.3 })],
  },
});
