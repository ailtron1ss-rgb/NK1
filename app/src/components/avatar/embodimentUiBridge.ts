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
import { DEFAULT_RENDERER_MANIFESTS, createDefaultBodyRendererRegistry } from "./rendererRegistryDefaults.ts";

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
  /**
   * Optional renderer-neutral motion channels from the motion arbiter. Bounded
   * and merged with the derived channels; unsupported ones are reported by the
   * switch plan rather than dropped silently.
   */
  pose?: Readonly<Partial<Record<BodyChannel, number>>> | null;
}

const EXPRESSION_CHANNELS: readonly ExpressionChannel[] = [
  "neutral", "joy", "sadness", "anger", "anxiety", "curiosity", "protective", "surprise",
];

const EMOTION_TO_EXPRESSION: Record<EmotionLabel, ExpressionChannel> = {
  curiosity: "curiosity", calm: "neutral", joy: "joy", anxiety: "anxiety",
  frustration: "anger", sadness: "sadness", anger: "anger", protective: "protective",
};

/**
 * Live2D expression vocabulary sent to the viewer. Exported so the stage and the
 * viewer-contract test share one source: an unknown name makes the viewer drop the
 * whole intent frame, so every value here must be a key of the viewer's EXPR_MAP.
 */
export const EXPRESSION_TEXT: Record<EmotionLabel, string> = {
  curiosity: "thinking", calm: "neutral", joy: "happy", anxiety: "sad",
  frustration: "angry", sadness: "sad", anger: "angry", protective: "focused",
};

/**
 * Static capability table. `mode` is the coarse renderer class the switch
 * contract understands (2D = `live2d`, 2.5D = `depth2d`, 3D = `vrm3d`);
 * `rendererId` is the precise adapter identity, so two 2D renderers still switch.
 *
 * Derived from the canonical default manifests so declared channels cannot drift
 * between the registry and the switch contract.
 */
const UI_MODE_TO_RENDERER_ID: Record<UiRenderMode, string> = {
  live2d: "nk1-live2d-cubism",
  original: "nk1-original-svg-2d",
  legacy: "nk1-legacy-sprites-2d",
  "3d": "nk1-three-vrm3d",
};

const manifestToCapabilities = (rendererId: string): RendererCapabilities => {
  const manifest = DEFAULT_RENDERER_MANIFESTS.find((entry) => entry.rendererId === rendererId);
  if (!manifest) throw new TypeError(`missing-default-renderer-manifest:${rendererId}`);
  return {
    mode: manifest.mode,
    rendererId: manifest.rendererId,
    channels: manifest.channels,
    expressions: manifest.expressions,
    supportsSpeechVisemes: manifest.supportsSpeechVisemes,
    supportsWorldTargets: manifest.supportsWorldTargets,
    supportsClothingLayers: manifest.supportsClothingLayers,
    supportsPhysics: manifest.supportsPhysics,
  };
};

const CAPABILITY_TABLE: Record<UiRenderMode, RendererCapabilities> = {
  live2d: manifestToCapabilities(UI_MODE_TO_RENDERER_ID.live2d),
  original: manifestToCapabilities(UI_MODE_TO_RENDERER_ID.original),
  legacy: manifestToCapabilities(UI_MODE_TO_RENDERER_ID.legacy),
  "3d": manifestToCapabilities(UI_MODE_TO_RENDERER_ID["3d"]),
};

const clamp01 = (value: number | null | undefined): number => Math.max(0, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0));
const clampUnit = (value: number | null | undefined): number => Math.max(-1, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0));

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

/** The canonical default registry for the wired UI modes. */
export const defaultBodyRendererRegistry = createDefaultBodyRendererRegistry();

const CHANNEL_KEYS: ReadonlySet<BodyChannel> = new Set([
  "headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch",
  "leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist",
  "leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle",
  "leftHand", "rightHand", "leftFingers", "rightFingers", "gazeX", "gazeY", "breath", "rootYaw",
]);

/** Merge bounded arbiter channels with derived channels; derived values win on conflict. */
function mergePoseChannels(
  derived: Partial<Record<BodyChannel, number>>,
  extra: Readonly<Partial<Record<BodyChannel, number>>> | null | undefined,
): Partial<Record<BodyChannel, number>> {
  const merged: Partial<Record<BodyChannel, number>> = { ...derived };
  if (!extra) return merged;
  for (const [key, value] of Object.entries(extra) as [BodyChannel, number][]) {
    if (!CHANNEL_KEYS.has(key) || key in derived || !Number.isFinite(value)) continue;
    merged[key] = Math.max(-1, Math.min(1, value));
  }
  return merged;
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
    pose: mergePoseChannels({
      headRoll: clampUnit(input.headTilt),
      gazeX,
      gazeY,
    }, input.pose),
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

/**
 * Advance a handoff from a fixed monotonic start time.
 *
 * `advanceBodySwitch` takes cumulative elapsed-since-start, but a requestAnimationFrame
 * loop naturally has only the current timestamp and the previous one. Passing the
 * per-frame delta there keeps `elapsedMs/durationMs` at a single frame's fraction
 * (~16/220), so the crossfade creeps forward and never reaches `committed`. This
 * helper derives the correct cumulative elapsed from the transition origin so the
 * handoff finishes within `durationMs`.
 */
export function advanceBodySwitchFromStart(
  previous: BodySwitchProgress,
  startMonotonicMs: number,
  nowMonotonicMs: number,
  durationMs: number,
): BodySwitchProgress {
  if (!Number.isFinite(startMonotonicMs) || !Number.isFinite(nowMonotonicMs)) return previous;
  return advanceBodySwitch(previous, Math.max(0, nowMonotonicMs - startMonotonicMs), durationMs);
}

export type { EmbodimentMode, SwitchPlan };
