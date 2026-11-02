/**
 * UI bridge for renderer-neutral body switching (NK1 aspect 11).
 *
 * Integration layer between the canonical organism snapshot and the pure
 * `embodimentSwitch` contract. It projects a `SemanticBodyState` plus static
 * renderer capability descriptors and exposes the bounded handoff used by
 * `AvatarStage`. It never mutates organism state and never claims that a
 * renderer executed a channel it does not support.
 */
import type { EmotionLabel, OrganismSnapshot } from "@/organism/types";
import {
  projectAvatarBrainState,
  type AvatarBrainProjection,
  type AvatarRenderProfile,
} from "../../../../runtime/neuro-kurisu/src/organism/body/AvatarBrainAffectBridge.ts";
import { advanceSwitchProgress, planEmbodimentSwitch } from "./embodimentSwitch.ts";
import type {
  BodyChannel,
  EmbodimentMode,
  ExpressionChannel,
  RendererCapabilities,
  SemanticBodyState,
  SpeechPhase,
  SwitchPlan,
} from "./embodimentSwitch.ts";
import type { MouthPose } from "./embodimentTimeline";

/** UI renderer modes. `legacy` and `original` are 2D fallbacks, not skeletal adapters. */
export type UiRenderMode = "live2d" | "legacy" | "original" | "3d";

/** Bounded monotonic handoff progress used to drive a crossfade. */
export interface BodySwitchProgress {
  progress: number;
  committed: boolean;
}

export interface SemanticBodyProjectionInput {
  snapshot: OrganismSnapshot;
  revision: number;
  monotonicMs: number;
  headTilt: number;
  /** Optional because sensor providers may omit a sample during handoff/reconnect. */
  gaze?: { x: number; y: number } | null;
  /** Untrusted provider lifecycle data is normalized before entering semantic state. */
  speechPhase: unknown;
  /** Opaque external event identity; malformed values are dropped at the boundary. */
  speechEventId: unknown;
  audioTimeMs: number;
  /** Optional because viseme/mouth samples can be absent between audio frames. */
  mouth?: MouthPose | null;
}

const EXPRESSION_CHANNELS: readonly ExpressionChannel[] = [
  "neutral", "joy", "sadness", "anger", "anxiety", "curiosity", "protective", "surprise",
];

const EMOTION_TO_EXPRESSION: Record<EmotionLabel, ExpressionChannel> = {
  curiosity: "curiosity", calm: "neutral", joy: "joy", anxiety: "anxiety",
  frustration: "anger", sadness: "sadness", anger: "anger", protective: "protective",
};

const EXPRESSION_TEXT: Record<EmotionLabel, string> = {
  curiosity: "thinking", calm: "neutral", joy: "happy", anxiety: "sad",
  frustration: "angry", sadness: "sad", anger: "angry", protective: "focused",
};

/**
 * Channels each wired renderer actually applies today. Deliberately narrow:
 * limbs, hands and clothing layers are not driven by the current UI, so they are
 * reported as unsupported instead of being silently dropped.
 */
const LIVE2D_CHANNELS: readonly BodyChannel[] = ["headRoll", "gazeX", "gazeY", "breath"];
const SVG_CHANNELS: readonly BodyChannel[] = ["gazeX", "gazeY"];
const SPRITE_CHANNELS: readonly BodyChannel[] = [];
const VRM3D_CHANNELS: readonly BodyChannel[] = ["gazeX", "gazeY"];

/**
 * Static capability table. `mode` is the coarse renderer class the switch
 * contract understands (2D = `live2d`, 2.5D = `depth2d`, 3D = `vrm3d`);
 * `rendererId` is the precise adapter identity, so two 2D renderers still switch.
 */
const CAPABILITY_TABLE: Record<UiRenderMode, RendererCapabilities> = {
  live2d: {
    mode: "live2d", rendererId: "nk1-live2d-cubism", channels: LIVE2D_CHANNELS,
    expressions: EXPRESSION_CHANNELS, supportsSpeechVisemes: true,
    supportsWorldTargets: true, supportsClothingLayers: false, supportsPhysics: true,
  },
  original: {
    mode: "live2d", rendererId: "nk1-original-svg-2d", channels: SVG_CHANNELS,
    expressions: EXPRESSION_CHANNELS, supportsSpeechVisemes: false,
    supportsWorldTargets: true, supportsClothingLayers: false, supportsPhysics: false,
  },
  legacy: {
    mode: "live2d", rendererId: "nk1-legacy-sprites-2d", channels: SPRITE_CHANNELS,
    expressions: EXPRESSION_CHANNELS, supportsSpeechVisemes: false,
    supportsWorldTargets: false, supportsClothingLayers: false, supportsPhysics: false,
  },
  "3d": {
    mode: "vrm3d", rendererId: "nk1-three-vrm3d", channels: VRM3D_CHANNELS,
    expressions: EXPRESSION_CHANNELS, supportsSpeechVisemes: true,
    supportsWorldTargets: true, supportsClothingLayers: false, supportsPhysics: true,
  },
};

const clamp01 = (value: number | null | undefined): number => Math.max(0, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0));
const clampUnit = (value: number | null | undefined): number => Math.max(-1, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0));

export interface AvatarBrainProjectionOptions {
  profile?: AvatarRenderProfile;
  now?: number;
  previous?: AvatarBrainProjection;
}

/** Adapt the canonical snapshot without creating a second personality model.
 * Only scalar channels leave cognition; memory text, IDs, chat and thoughts stay internal. */
export function projectOrganismSnapshotToAvatarBrain(
  snapshot: OrganismSnapshot,
  options: AvatarBrainProjectionOptions = {},
): AvatarBrainProjection {
  const now = typeof options.now === "number" && Number.isFinite(options.now) ? options.now : Date.now();
  const sampledAt = typeof snapshot.at === "number" && Number.isFinite(snapshot.at) && snapshot.at > 0
    ? snapshot.at
    : now;
  const retrievedIds = new Set(snapshot.lastDecision?.retrievedIds ?? []);
  const memoryRecall01 = snapshot.memories.reduce((highest, memory) =>
    retrievedIds.has(memory.id) ? Math.max(highest, clamp01(memory.salience)) : highest, 0);
  const traits = Object.entries(snapshot.identity.traits ?? {});
  return projectAvatarBrainState({
    state: {
      needs: snapshot.needs,
      predictionError: snapshot.predictionError,
      // Not present in this public snapshot: never infer these from trust or reward.
      lastActionSuccess: null,
      lastPredictionConfidence: snapshot.canonicalWorld.latentConfidence01,
      autonomyScore: 0.5,
    },
    awake: snapshot.awake,
    affect: {
      valence01: snapshot.emotion.valence,
      arousal01: snapshot.emotion.arousal,
      dominance01: snapshot.emotion.dominance,
      curiosity01: snapshot.curiosity,
      confidence01: snapshot.canonicalWorld.latentConfidence01,
      memoryRecall01,
      sampledAt,
    },
    personality: {
      adaptiveNames: traits.map(([name]) => name),
      adaptiveValues: traits.map(([, value]) => value),
    },
    previous: options.previous,
    now,
    profile: options.profile ?? "2d",
  });
}

const SPEECH_PHASES = new Set<SpeechPhase>(["idle", "starting", "speaking", "ended", "cancelled", "unknown"]);

/** Normalize lifecycle data at the renderer boundary; malformed phases never abort a body handoff. */
const normalizeSpeechPhase = (value: unknown): SpeechPhase =>
  typeof value === "string" && SPEECH_PHASES.has(value as SpeechPhase) ? value as SpeechPhase : "unknown";

/** Event IDs are opaque identifiers, but blank, non-string and oversized values are not useful evidence. */
const normalizeSpeechEventId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128 ? normalized : null;
};

export function capabilitiesForMode(mode: UiRenderMode): RendererCapabilities {
  return CAPABILITY_TABLE[mode];
}

/** Project the canonical snapshot into a renderer-neutral semantic body state. */
export function projectSemanticBodyState(input: SemanticBodyProjectionInput): SemanticBodyState {
  const label = input.snapshot.emotion.label;
  const gazeX = clampUnit(input.gaze?.x);
  const gazeY = clampUnit(input.gaze?.y);
  const speechPhase = normalizeSpeechPhase(input.speechPhase);
  return {
    schemaVersion: 1,
    revision: Number.isSafeInteger(input.revision) && input.revision >= 0 ? input.revision : 0,
    capturedAtMonotonicMs: Math.max(0, Number.isFinite(input.monotonicMs) ? input.monotonicMs : 0),
    emotion: EMOTION_TO_EXPRESSION[label] ?? "neutral",
    emotionIntensity: clamp01(input.snapshot.emotion.arousal),
    expression: EXPRESSION_TEXT[label] ?? "neutral",
    gaze: { x: gazeX, y: gazeY },
    speech: {
      eventId: normalizeSpeechEventId(input.speechEventId),
      phase: speechPhase,
      audioTimeMs: Math.max(0, Number.isFinite(input.audioTimeMs) ? input.audioTimeMs : 0),
      // Only active speech may drive mouth motion; terminal/unknown phases must not
      // preserve a stale open-mouth sample after interruption or reconnect.
      mouthOpen: speechPhase === "speaking" ? clamp01(input.mouth?.open) : 0,
      mouthForm: speechPhase === "speaking" ? clampUnit(input.mouth?.form) : 0,
    },
    action: (typeof input.snapshot.lastOption === "string" && input.snapshot.lastOption.trim()) ? input.snapshot.lastOption.slice(0, 96) : "wait",
    intentId: null,
    pose: {
      headRoll: clampUnit(input.headTilt),
      gazeX,
      gazeY,
    },
    wardrobeId: null,
  };
}

/**
 * Plan a capability-aware handoff. Throws if the projected state is invalid.
 *
 * `requiresNeutralRebind` is recomputed from the precise renderer identity, not
 * the coarse mode: switching between two different 2D renderers (e.g. Live2D to
 * the SVG original) still replaces the body and therefore still needs a rebind.
 */
export function beginBodySwitch(
  from: UiRenderMode,
  to: UiRenderMode,
  state: SemanticBodyState,
): { plan: SwitchPlan; progress: BodySwitchProgress } {
  const plan = planEmbodimentSwitch(CAPABILITY_TABLE[from].mode, CAPABILITY_TABLE[to], state);
  return {
    plan: { ...plan, requiresNeutralRebind: from !== to },
    progress: { progress: 0, committed: from === to },
  };
}

/** Monotonic crossfade progress; stale frames cannot move a handoff backwards. */
export function advanceBodySwitch(
  previous: BodySwitchProgress,
  elapsedMs: number,
  durationMs: number,
): BodySwitchProgress {
  const progress = advanceSwitchProgress(previous.progress, elapsedMs, durationMs);
  return { progress, committed: progress >= 1 };
}

export type { EmbodimentMode, SwitchPlan };
