/**
 * Shared browser-side speech clock and Live2D intent contract.
 *
 * Web Speech exposes word/sentence boundary events, not the rendered PCM stream
 * or phoneme boundaries. The timeline therefore interpolates per-grapheme
 * visemes and re-anchors them to actual speech boundary events. It is a useful
 * lip-sync approximation, not acoustic/phoneme-level ground truth.
 */
import {
  CLOSED_MOUTH,
  buildVisemeTimeline,
  poseForGrapheme,
  sampleVisemeTimeline,
  timelineOffsetForCharIndex,
} from "../../../../runtime/neuro-kurisu/public/speech-viseme-core.mjs";
import type { MouthPose, VisemeFrame, VisemeName } from "../../../../runtime/neuro-kurisu/public/speech-viseme-core.mjs";

export { CLOSED_MOUTH, buildVisemeTimeline, poseForGrapheme, sampleVisemeTimeline, timelineOffsetForCharIndex };
export { deriveEmbodimentPose } from "../../../../runtime/neuro-kurisu/public/embodiment-pose.mjs";
export type { MouthPose, VisemeFrame, VisemeName };
export type SpeechPhase = "idle" | "starting" | "speaking" | "ended" | "cancelled" | "unknown";

/** A provider-observed character boundary mapped onto the monotonic audio clock. */
export interface VisemeClockAnchor {
  charIndex: number;
  audioTimeMs: number;
  timelineTimeMs: number;
}

export interface EmbodimentIntentV1 {
  type: "kurisu_embodiment_intent";
  protocolVersion: 1;
  stateVersion: number;
  sentAtEpochMs: number;
  speechEventId: string | null;
  audioClockId: string | null;
  speechPhase: SpeechPhase;
  audioTimeMs: number;
  clockSource: "speech-synthesis-elapsed-time-anchored-monotonic" | "speech-synthesis-boundary-anchored-monotonic" | "runtime-tts-start-anchored-monotonic" | "none";
  priority: number;
  cancellationToken: string | null;
  expression: string;
  expressionIntensity: number;
  mouth: MouthPose;
  gaze: { x: number; y: number; driven: boolean };
  body: {
    headTilt: number;
    /** Optional normalized head orientation; older v1 senders fall back to gaze. */
    headAngleX?: number;
    headAngleY?: number;
    /** Optional normalized torso orientation and breathing intensity. */
    bodyAngleX?: number;
    bodyAngleY?: number;
    bodyAngleZ?: number;
    breathIntensity?: number;
    gesture: boolean;
    motionGroup: string;
    motionIndex: number;
    motionToken: number;
  };
  voiceEmphasis: number;
}

const clamp = (n: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));

export interface EmbodimentAffectState {
  sampleAtMs: number;
  expressionIntensity: number;
  gazeX: number;
  gazeY: number;
  headTilt: number;
  voiceEmphasis: number;
}
export type EmbodimentAffectTarget = Omit<EmbodimentAffectState, "sampleAtMs">;

/**
 * Smooth the slow affective channels while leaving viseme/audio timing untouched.
 * A monotonic timestamp and bounded time constant prevent late snapshots from
 * rewinding the avatar or producing large single-frame jumps.
 */
export function smoothEmbodimentAffect(
  previous: EmbodimentAffectState | null,
  target: EmbodimentAffectTarget,
  nowMs: number,
  timeConstantMs = 180,
): EmbodimentAffectState {
  const bounded = {
    expressionIntensity: clamp(target.expressionIntensity, 0, 1),
    gazeX: clamp(target.gazeX, -1, 1),
    gazeY: clamp(target.gazeY, -1, 1),
    headTilt: clamp(target.headTilt, -0.15, 0.15),
    voiceEmphasis: clamp(target.voiceEmphasis, 0, 1),
  };
  const now = Number.isFinite(nowMs) ? Math.max(0, nowMs) : (previous?.sampleAtMs ?? 0);
  if (!previous) return { sampleAtMs: now, ...bounded };
  if (!Number.isFinite(previous.sampleAtMs) || now <= previous.sampleAtMs) return { ...previous };
  const tau = clamp(timeConstantMs, 40, 1000);
  const elapsed = Math.min(1000, now - previous.sampleAtMs);
  const alpha = 1 - Math.exp(-elapsed / tau);
  const blend = (before: number, after: number, low: number, high: number) =>
    clamp(before + (after - before) * alpha, low, high);
  return {
    sampleAtMs: now,
    expressionIntensity: blend(previous.expressionIntensity, bounded.expressionIntensity, 0, 1),
    gazeX: blend(previous.gazeX, bounded.gazeX, -1, 1),
    gazeY: blend(previous.gazeY, bounded.gazeY, -1, 1),
    headTilt: blend(previous.headTilt, bounded.headTilt, -0.15, 0.15),
    voiceEmphasis: blend(previous.voiceEmphasis, bounded.voiceEmphasis, 0, 1),
  };
}


/**
 * Append a SpeechSynthesis boundary without admitting stale/out-of-order events.
 * A later observed character is authoritative even when our estimate had advanced
 * too far; the audio clock itself remains monotonic, while the character mapping
 * may be recalibrated to the actual boundary.
 */
export function appendVisemeClockAnchor(
  anchors: VisemeClockAnchor[],
  anchor: VisemeClockAnchor,
  maxAnchors = 16,
): VisemeClockAnchor[] {
  if (!Number.isSafeInteger(anchor.charIndex) || anchor.charIndex < 0
    || !Number.isFinite(anchor.audioTimeMs) || anchor.audioTimeMs < 0
    || !Number.isFinite(anchor.timelineTimeMs) || anchor.timelineTimeMs < 0) return anchors;
  const last = anchors.at(-1);
  if (last && (anchor.charIndex < last.charIndex || anchor.audioTimeMs < last.audioTimeMs || anchor.timelineTimeMs < last.timelineTimeMs)) return anchors;
  if (last && anchor.charIndex === last.charIndex) {
    // Let the first actual boundary refine the synthetic start anchor, but ignore repeats.
    if (anchors.length === 1 && last.charIndex === 0 && anchor.audioTimeMs > last.audioTimeMs) return [anchor];
    return anchors;
  }
  const next = [...anchors, anchor];
  return next.length > maxAnchors ? next.slice(next.length - maxAnchors) : next;
}

/** Map the one monotonic audio clock to the text/viseme timeline.
 * Recent boundary pairs estimate local speaking rate; without enough independent
 * anchors the schedule uses a 1:1 fallback and is re-anchored at the next boundary.
 */
export function sampleVisemeClock(anchors: VisemeClockAnchor[], audioTimeMs: number): number {
  if (!anchors.length || !Number.isFinite(audioTimeMs) || audioTimeMs < 0) return 0;
  const latest = anchors[anchors.length - 1];
  const previous = anchors.length > 1 ? anchors[anchors.length - 2] : null;
  let scale = 1;
  if (previous) {
    const audioDelta = latest.audioTimeMs - previous.audioTimeMs;
    const timelineDelta = latest.timelineTimeMs - previous.timelineTimeMs;
    if (audioDelta >= 30 && timelineDelta >= 0) scale = clamp(timelineDelta / audioDelta, 0.5, 1.8);
  }
  return Math.max(0, latest.timelineTimeMs + Math.max(0, audioTimeMs - latest.audioTimeMs) * scale);
}

/** Sample an elapsed speech clock without allowing late events to lower its high-water mark. */
export function sampleMonotonicAudioClock(
  highWaterMs: number,
  anchorElapsedMs: number,
  anchorPerformanceAtMs: number,
  nowPerformanceMs: number,
): number {
  const highWater = Number.isFinite(highWaterMs) ? Math.max(0, highWaterMs) : 0;
  if (!Number.isFinite(anchorElapsedMs) || !Number.isFinite(anchorPerformanceAtMs) || !Number.isFinite(nowPerformanceMs)) return highWater;
  const extrapolated = Math.max(0, anchorElapsedMs) + Math.max(0, nowPerformanceMs - anchorPerformanceAtMs);
  return Math.max(highWater, extrapolated);
}

/** Re-anchor elapsedTime only after sampling the current clock; a late lower value cannot rewind it. */
export function reanchorMonotonicAudioClock(
  highWaterMs: number,
  anchorElapsedMs: number,
  anchorPerformanceAtMs: number,
  nowPerformanceMs: number,
  reportedElapsedMs: number,
): { anchorElapsedMs: number; anchorPerformanceAtMs: number; highWaterMs: number } {
  const current = sampleMonotonicAudioClock(highWaterMs, anchorElapsedMs, anchorPerformanceAtMs, nowPerformanceMs);
  const reported = Number.isFinite(reportedElapsedMs) ? Math.max(0, reportedElapsedMs) : current;
  const next = Math.max(current, reported);
  return { anchorElapsedMs: next, anchorPerformanceAtMs: nowPerformanceMs, highWaterMs: next };
}

export function isEmbodimentIntentV1(value: unknown): value is EmbodimentIntentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const intent = value as Partial<EmbodimentIntentV1>;
  const phases: SpeechPhase[] = ["idle", "starting", "speaking", "ended", "cancelled", "unknown"];
  if (intent.type !== "kurisu_embodiment_intent" || intent.protocolVersion !== 1) return false;
  if (!Number.isSafeInteger(intent.stateVersion) || Number(intent.stateVersion) <= 0) return false;
  if (!Number.isFinite(intent.sentAtEpochMs) || !Number.isFinite(intent.audioTimeMs) || Number(intent.audioTimeMs) < 0) return false;
  if (!phases.includes(intent.speechPhase as SpeechPhase)) return false;
  const validId = (id: unknown, maxLength: number): boolean => id === null || (typeof id === "string" && id.length > 0 && id.length <= maxLength);
  if (!validId(intent.speechEventId, 180) || !validId(intent.audioClockId, 220)) return false;
  if (intent.speechPhase === "speaking" && (!intent.speechEventId || !intent.audioClockId)) return false;
  if (intent.clockSource !== "none" && intent.clockSource !== "speech-synthesis-boundary-anchored-monotonic" && intent.clockSource !== "speech-synthesis-elapsed-time-anchored-monotonic" && intent.clockSource !== "runtime-tts-start-anchored-monotonic") return false;
  if (!Number.isFinite(intent.priority) || Number(intent.priority) < 0 || Number(intent.priority) > 100) return false;
  if (intent.cancellationToken !== null && (typeof intent.cancellationToken !== "string" || intent.cancellationToken.length > 220)) return false;
  if (typeof intent.expression !== "string" || intent.expression.length > 32) return false;
  if (!Number.isFinite(intent.expressionIntensity) || Number(intent.expressionIntensity) < 0 || Number(intent.expressionIntensity) > 1) return false;
  if (!intent.mouth || !Number.isFinite(intent.mouth.open) || intent.mouth.open < 0 || intent.mouth.open > 1) return false;
  if (!Number.isFinite(intent.mouth.form) || intent.mouth.form < -1 || intent.mouth.form > 1) return false;
  if (typeof intent.mouth.viseme !== "string" || !/^[a-z]{1,16}$/.test(intent.mouth.viseme)) return false;
  if (!intent.gaze || !Number.isFinite(intent.gaze.x) || intent.gaze.x < -1 || intent.gaze.x > 1 || !Number.isFinite(intent.gaze.y) || intent.gaze.y < -1 || intent.gaze.y > 1 || typeof intent.gaze.driven !== "boolean") return false;
  if (!intent.body || !Number.isFinite(intent.body.headTilt) || intent.body.headTilt < -0.15 || intent.body.headTilt > 0.15) return false;
  const bodyChannelRanges = [
    [intent.body.headAngleX, -1, 1], [intent.body.headAngleY, -1, 1],
    [intent.body.bodyAngleX, -1, 1], [intent.body.bodyAngleY, -1, 1],
    [intent.body.bodyAngleZ, -1, 1], [intent.body.breathIntensity, 0, 1],
  ] as const;
  for (const [value, min, max] of bodyChannelRanges) {
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) return false;
  }
  if (typeof intent.body.gesture !== "boolean" || typeof intent.body.motionGroup !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(intent.body.motionGroup)) return false;
  if (!Number.isInteger(intent.body.motionIndex) || intent.body.motionIndex < 0 || intent.body.motionIndex > 32 || !Number.isSafeInteger(intent.body.motionToken) || intent.body.motionToken < 0) return false;
  return Number.isFinite(intent.voiceEmphasis) && Number(intent.voiceEmphasis) >= 0 && Number(intent.voiceEmphasis) <= 1;
}
