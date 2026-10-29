/**
 * Shared browser-side speech clock and Live2D intent contract.
 *
 * Web Speech exposes word/sentence boundary events, not the rendered PCM stream
 * or phoneme boundaries. The timeline therefore interpolates per-grapheme
 * visemes and re-anchors them to actual speech boundary events. It is a useful
 * lip-sync approximation, not acoustic/phoneme-level ground truth.
 */

import { deriveEmbodimentPose } from "../../../../runtime/neuro-kurisu/public/embodiment-pose.mjs";
export { deriveEmbodimentPose };

export type VisemeName = "rest" | "closed" | "teeth" | "wide" | "open" | "round" | "neutral";
export type SpeechPhase = "idle" | "starting" | "speaking" | "ended" | "cancelled" | "unknown";

export interface MouthPose {
  open: number;
  form: number;
  viseme: VisemeName;
}

export interface VisemeFrame {
  /** Inclusive UTF-16 offset reported by SpeechSynthesis boundary events. */
  charIndex: number;
  /** Exclusive UTF-16 offset; keeps combining/ZWJ graphemes addressable as one frame. */
  endCharIndex: number;
  startMs: number;
  endMs: number;
  pose: MouthPose;
}

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
  clockSource: "speech-synthesis-elapsed-time-anchored-monotonic" | "speech-synthesis-boundary-anchored-monotonic" | "none";
  priority: number;
  cancellationToken: string | null;
  expression: string;
  expressionIntensity: number;
  mouth: MouthPose;
  gaze: { x: number; y: number; driven: boolean };
  body: {
    headTilt: number;
    /** Optional normalized head yaw; older v1 senders may omit it. */
    headAngleX?: number;
    /** Optional normalized head pitch; older v1 senders may omit it. */
    headAngleY?: number;
    /** Optional normalized torso angles mapped by each renderer to its own rig. */
    bodyAngleX?: number;
    bodyAngleY?: number;
    bodyAngleZ?: number;
    /** Optional breathing intensity in [0, 1]. */
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

export const CLOSED_MOUTH: MouthPose = Object.freeze({ open: 0.015, form: 0, viseme: "rest" });

export function poseForGrapheme(grapheme: string): MouthPose {
  const char = String(grapheme ?? "").toLocaleLowerCase().normalize("NFKC");
  if (!char || /^\s$/u.test(char)) return { open: 0.045, form: 0, viseme: "neutral" };
  if (/^[.,!?;:…—–-]$/u.test(char)) return { ...CLOSED_MOUTH };
  if (/[мбп]/u.test(char) || /[bmp]/u.test(char)) return { open: 0.025, form: -0.05, viseme: "closed" };
  if (/[фв]/u.test(char) || /[fv]/u.test(char)) return { open: 0.14, form: 0.18, viseme: "teeth" };
  if (/[оуёю]/u.test(char) || /[ouw]/u.test(char)) return { open: 0.34, form: -0.46, viseme: "round" };
  if (/[аяaæɑɒ]/iu.test(char)) return { open: 0.60, form: 0.10, viseme: "open" };
  if (/[иыиеэ]/u.test(char) || /[eiy]/iu.test(char)) return { open: 0.25, form: 0.32, viseme: "wide" };
  if (/^[\p{L}\p{M}\p{N}]$/u.test(char)) return { open: 0.16, form: 0.02, viseme: "neutral" };
  return { ...CLOSED_MOUTH };
}

function graphemeDurationWeight(char: string): number {
  if (/^\s$/u.test(char)) return 0.55;
  if (/^[.,!?;:…—–-]$/u.test(char)) return char === "," || char === ";" || char === ":" ? 1.8 : 2.4;
  if (/[оуёю]/iu.test(char) || /[ouw]/iu.test(char)) return 1.55;
  if (/[аеёиоуыэюяaeiouy]/iu.test(char)) return 1.35;
  if (/[мбпbmpфвfv]/iu.test(char)) return 0.72;
  if (/^[\p{L}\p{M}\p{N}]$/u.test(char)) return 0.86;
  return 0.6;
}

type GraphemeSegment = { segment: string; index: number };

/** Segment user-visible graphemes while preserving SpeechSynthesis UTF-16 offsets. */
function segmentGraphemes(source: string, language: string): GraphemeSegment[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(language, { granularity: "grapheme" }).segment(source),
      ({ segment, index }) => ({ segment, index }));
  }

  // Compatibility fallback for engines without Intl.Segmenter. It joins combining
  // marks, variation selectors, emoji modifiers, ZWJ sequences and flag pairs.
  const result: GraphemeSegment[] = [];
  let utf16Index = 0;
  let regionalIndicatorsInCluster = 0;
  for (const codePoint of source) {
    const isMark = /^[\p{M}]$/u.test(codePoint);
    const isVariation = /^[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u.test(codePoint);
    const isEmojiModifier = /^[\u{1F3FB}-\u{1F3FF}]$/u.test(codePoint);
    const isRegionalIndicator = /^[\u{1F1E6}-\u{1F1FF}]$/u.test(codePoint);
    const previous = result[result.length - 1];
    const previousEndsInJoiner = previous?.segment.endsWith("\u200D") ?? false;
    const joinsRegionalPair = isRegionalIndicator && regionalIndicatorsInCluster === 1;
    if (previous && (isMark || isVariation || isEmojiModifier || codePoint === "\u200D" || previousEndsInJoiner || joinsRegionalPair)) {
      previous.segment += codePoint;
    } else {
      result.push({ segment: codePoint, index: utf16Index });
      regionalIndicatorsInCluster = 0;
    }
    if (isRegionalIndicator) regionalIndicatorsInCluster = joinsRegionalPair ? 0 : 1;
    else if (codePoint !== "\u200D" && !isMark && !isVariation && !isEmojiModifier) regionalIndicatorsInCluster = 0;
    utf16Index += codePoint.length;
  }
  return result;
}

export function buildVisemeTimeline(text: string, rate = 0.96, language = "ru-RU"): VisemeFrame[] {
  const source = String(text ?? "").replace(/[\r\n\t]/gu, " ");
  if (!source.length) return [];
  const graphemes = segmentGraphemes(source, language);
  const validRate = clamp(rate, 0.5, 2);
  const charsPerSecond = language.toLowerCase().startsWith("ru") ? 12.2 : 14.0;
  const targetDurationMs = Math.max(180, (graphemes.length / (charsPerSecond * validRate)) * 1000);
  const rawWeights = graphemes.map(({ segment }) => graphemeDurationWeight(segment));
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const msPerWeight = targetDurationMs / Math.max(1, totalWeight);
  let atMs = 0;
  return graphemes.map(({ segment, index }, frameIndex) => {
    const startMs = atMs;
    const endMs = startMs + rawWeights[frameIndex] * msPerWeight;
    const frame: VisemeFrame = {
      charIndex: index,
      endCharIndex: index + segment.length,
      startMs,
      endMs,
      pose: poseForGrapheme(segment),
    };
    atMs = endMs;
    return frame;
  });
}

export function timelineOffsetForCharIndex(timeline: VisemeFrame[], charIndex: number): number {
  if (!timeline.length || !Number.isFinite(charIndex) || charIndex <= 0) return 0;
  const target = Math.floor(charIndex);
  const last = timeline[timeline.length - 1];
  if (target >= last.endCharIndex) return last.endMs;
  let low = 0;
  let high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const frame = timeline[mid];
    if (target < frame.charIndex) high = mid - 1;
    else if (target >= frame.endCharIndex) low = mid + 1;
    else return frame.startMs;
  }
  return timeline[0].startMs;
}

export function sampleVisemeTimeline(timeline: VisemeFrame[], timeMs: number): MouthPose {
  if (!timeline.length || !Number.isFinite(timeMs) || timeMs < 0) return { ...CLOSED_MOUTH };
  let low = 0;
  let high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const frame = timeline[mid];
    if (timeMs < frame.startMs) high = mid - 1;
    else if (timeMs >= frame.endMs) low = mid + 1;
    else return frame.pose;
  }
  return { ...CLOSED_MOUTH };
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
  if (intent.clockSource !== "none" && intent.clockSource !== "speech-synthesis-boundary-anchored-monotonic" && intent.clockSource !== "speech-synthesis-elapsed-time-anchored-monotonic") return false;
  if (!Number.isFinite(intent.priority) || Number(intent.priority) < 0 || Number(intent.priority) > 100) return false;
  if (intent.cancellationToken !== null && (typeof intent.cancellationToken !== "string" || intent.cancellationToken.length > 220)) return false;
  if (typeof intent.expression !== "string" || intent.expression.length > 32) return false;
  if (!Number.isFinite(intent.expressionIntensity) || Number(intent.expressionIntensity) < 0 || Number(intent.expressionIntensity) > 1) return false;
  if (!intent.mouth || !Number.isFinite(intent.mouth.open) || intent.mouth.open < 0 || intent.mouth.open > 1) return false;
  if (!Number.isFinite(intent.mouth.form) || intent.mouth.form < -1 || intent.mouth.form > 1) return false;
  if (typeof intent.mouth.viseme !== "string" || !/^[a-z]{1,16}$/.test(intent.mouth.viseme)) return false;
  if (!intent.gaze || !Number.isFinite(intent.gaze.x) || intent.gaze.x < -1 || intent.gaze.x > 1 || !Number.isFinite(intent.gaze.y) || intent.gaze.y < -1 || intent.gaze.y > 1 || typeof intent.gaze.driven !== "boolean") return false;
  if (!intent.body || !Number.isFinite(intent.body.headTilt) || intent.body.headTilt < -0.15 || intent.body.headTilt > 0.15) return false;
  if (typeof intent.body.gesture !== "boolean" || typeof intent.body.motionGroup !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(intent.body.motionGroup)) return false;
  if (!Number.isInteger(intent.body.motionIndex) || intent.body.motionIndex < 0 || intent.body.motionIndex > 32 || !Number.isSafeInteger(intent.body.motionToken) || intent.body.motionToken < 0) return false;
  for (const [value, min, max] of [
    [intent.body.headAngleX, -1, 1], [intent.body.headAngleY, -1, 1],
    [intent.body.bodyAngleX, -1, 1], [intent.body.bodyAngleY, -1, 1],
    [intent.body.bodyAngleZ, -1, 1], [intent.body.breathIntensity, 0, 1],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) return false;
  }
  return Number.isFinite(intent.voiceEmphasis) && Number(intent.voiceEmphasis) >= 0 && Number(intent.voiceEmphasis) <= 1;
}
