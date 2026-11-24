import type { ActionKind, EmotionLabel, OrganismSnapshot, AvatarBrainProjectionV1, AvatarBrainChannelsV1 } from "@/organism/types";
import type { AvatarMotorIntentPlan } from "./motorIntent.ts";
import type { BodyChannel } from "./embodimentSwitch.ts";
import { planAvatarMotorIntent } from "./motorIntent.ts";
import { EXPRESSION_TEXT } from "./embodimentUiBridge.ts";
import {
  avatarBrainBodyChannels, avatarBrainFrameForTick, avatarBrainGaze,
  avatarBrainHeadTilt, avatarBrainLive2DExpression, avatarBrainMouthPose,
} from "./avatarBrainUi.ts";
import {
  CLOSED_MOUTH,
  type EmbodimentIntentV1,
  type MouthPose,
  type SpeechPhase,
  type VisemeName,
} from "./embodimentTimeline.ts";

const GAZE_BY_ACTION: Record<ActionKind, { x: number; y: number }> = {
  explore: { x: 0.24, y: 0.04 },
  verify: { x: 0.14, y: -0.1 },
  reflect: { x: -0.19, y: -0.14 },
  respond: { x: 0.01, y: 0.01 },
  wait: { x: -0.035, y: -0.005 },
  rest: { x: -0.06, y: 0.075 },
};

const SPEECH_PHASES: readonly SpeechPhase[] = [
  "idle", "starting", "speaking", "ended", "cancelled", "unknown",
];
const CLOCK_SOURCES: readonly EmbodimentIntentV1["clockSource"][] = [
  "none",
  "speech-synthesis-elapsed-time-anchored-monotonic",
  "speech-synthesis-boundary-anchored-monotonic",
];
const VISEMES: readonly VisemeName[] = [
  "rest", "closed", "teeth", "wide", "open", "round", "neutral",
];

const clamp = (value: number, min: number, max: number, fallback = min): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

function boundedId(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function normalizeMouthPose(value: MouthPose): MouthPose {
  if (!value || typeof value !== "object" || !VISEMES.includes(value.viseme)) return { ...CLOSED_MOUTH };
  if (!Number.isFinite(value.open) || !Number.isFinite(value.form)) return { ...CLOSED_MOUTH };
  return {
    open: clamp(value.open, 0, 1),
    form: clamp(value.form, -1, 1),
    viseme: value.viseme,
  };
}

export interface AvatarRenderProjectionInput {
  snapshot: OrganismSnapshot;
  thinking: boolean;
  /** True only while the UI confirms a currently active browser speech utterance. */
  speaking: boolean;
  hasFreshTurn: boolean;
  turnText: string;
  speechPhase: SpeechPhase;
  speechEventId: string | null;
  audioClockId: string | null;
  audioTimeMs: number;
  clockSource: EmbodimentIntentV1["clockSource"];
  mouthPose: MouthPose;
  voiceEmphasis: number;
}

export interface AvatarRenderProjection {
  /** Raw organism option; 3D clip selection must continue to use this value. */
  action: ActionKind;
  motorPlan: AvatarMotorIntentPlan;
  brainFrame: AvatarBrainProjectionV1 | null;
  brainChannels: AvatarBrainChannelsV1 | null;
  bodyChannels: Partial<Record<BodyChannel, number>>;
  expression: string;
  expressionIntensity: number;
  gaze: { x: number; y: number };
  speech: {
    phase: SpeechPhase;
    speechEventId: string | null;
    audioClockId: string | null;
    audioTimeMs: number;
    clockSource: EmbodimentIntentV1["clockSource"];
  };
  /** Fresh assistant text turn, accepted only outside cancelled/unknown speech phases. */
  hasFreshTurn: boolean;
  /** Browser-confirmed speaking, not merely a pending speech lifecycle phase. */
  speaking: boolean;
  mouthPose: MouthPose;
  voiceEmphasis: number;
}

/**
 * Project one canonical organism/speech snapshot into a renderer-neutral frame.
 * This function has no browser effects and does not mutate its input.
 */
export function buildAvatarRenderProjection(input: AvatarRenderProjectionInput): AvatarRenderProjection {
  const snapshot = input.snapshot;
  const action = snapshot.lastOption;
  const brainFrame = avatarBrainFrameForTick(snapshot.avatarBrain, snapshot.tick);
  const phase = SPEECH_PHASES.includes(input.speechPhase) ? input.speechPhase : "unknown";
  const speechEventId = boundedId(input.speechEventId, 180);
  const audioClockId = boundedId(input.audioClockId, 220);
  const identityIsValid = speechEventId !== null && audioClockId !== null;
  const speechPhase: SpeechPhase = phase === "speaking" && !identityIsValid ? "unknown" : phase;
  const speaking = input.speaking === true && speechPhase === "speaking" && identityIsValid;
  const hasFreshTurn = input.hasFreshTurn === true && speechPhase !== "cancelled" && speechPhase !== "unknown";
  const clockSource = CLOCK_SOURCES.includes(input.clockSource) ? input.clockSource : "none";
  const audioTimeMs = clamp(input.audioTimeMs, 0, Number.MAX_SAFE_INTEGER, 0);

  const valence = clamp(snapshot.emotion.valence, 0, 1, 0.5);
  const arousal = clamp(snapshot.emotion.arousal, 0, 1, 0);
  const baseGaze = GAZE_BY_ACTION[action] ?? GAZE_BY_ACTION.wait;
  const valenceOffset = (valence - 0.5) * 0.16;
  const fallbackGaze = {
    x: clamp(baseGaze.x + valenceOffset, -0.4, 0.4, 0),
    y: clamp(baseGaze.y, -0.4, 0.4, 0),
  };
  const gaze = avatarBrainGaze(brainFrame, fallbackGaze);

  const plannedMotorPlan = planAvatarMotorIntent({
    emotion: snapshot.emotion.label as EmotionLabel,
    valence,
    arousal,
    action,
    thinking: input.thinking === true,
    speaking,
    hasFreshTurn,
    turnText: typeof input.turnText === "string" ? input.turnText : "",
    awake: snapshot.awake === true,
    energy: snapshot.needs.energy,
    cognitiveLoad: snapshot.needs.cognitiveLoad,
    uncertainty: snapshot.needs.uncertainty,
    socialNeed: snapshot.needs.socialNeed,
    novelty: snapshot.needs.novelty,
    goalPressure: snapshot.needs.goalPressure,
    predictionError: snapshot.predictionError,
    traits: snapshot.identity.traits,
  });
  // The semantic planner remains the one action/gesture owner. The brain frame
  // can contribute bounded physical offsets without creating another motor plan.
  const motorPlan = brainFrame
    ? { ...plannedMotorPlan, headTilt: avatarBrainHeadTilt(brainFrame, plannedMotorPlan.headTilt) }
    : plannedMotorPlan;

  return {
    action,
    motorPlan,
    brainFrame,
    brainChannels: brainFrame?.channels ?? null,
    bodyChannels: avatarBrainBodyChannels(brainFrame),
    expression: brainFrame ? avatarBrainLive2DExpression(brainFrame) : (EXPRESSION_TEXT[snapshot.emotion.label] ?? "neutral"),
    expressionIntensity: brainFrame?.expressionWeight ?? arousal,
    gaze,
    speech: {
      phase: speechPhase,
      speechEventId,
      audioClockId,
      audioTimeMs,
      clockSource: speechPhase === "unknown" ? "none" : clockSource,
    },
    hasFreshTurn,
    speaking,
    mouthPose: avatarBrainMouthPose(speaking ? normalizeMouthPose(input.mouthPose) : { ...CLOSED_MOUTH }, brainFrame, speaking),
    voiceEmphasis: speaking ? clamp(input.voiceEmphasis, 0, 1, 0) : 0,
  };
}
