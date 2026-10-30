/**
 * Renderer-neutral body continuity contract for NK1.
 *
 * A body switch changes the renderer, never the organism state. This module only
 * plans a capability-aware handoff; adapters remain responsible for applying and
 * verifying the pose in their own runtime. Unsupported channels are reported,
 * never silently represented as executed.
 */
export type EmbodimentMode = "live2d" | "depth2d" | "vrm3d";
export type BodyChannel =
  | "headYaw" | "headPitch" | "headRoll" | "torsoYaw" | "torsoPitch"
  | "leftShoulder" | "leftElbow" | "leftWrist" | "rightShoulder" | "rightElbow" | "rightWrist"
  | "leftHip" | "leftKnee" | "leftAnkle" | "rightHip" | "rightKnee" | "rightAnkle"
  | "leftHand" | "rightHand" | "leftFingers" | "rightFingers"
  | "gazeX" | "gazeY" | "breath" | "rootYaw";
export type ExpressionChannel = "neutral" | "joy" | "sadness" | "anger" | "anxiety" | "curiosity" | "protective" | "surprise";
export type SpeechPhase = "idle" | "starting" | "speaking" | "ended" | "cancelled" | "unknown";

export interface SemanticBodyState {
  schemaVersion: 1;
  revision: number;
  capturedAtMonotonicMs: number;
  emotion: ExpressionChannel;
  emotionIntensity: number;
  expression: string;
  gaze: Readonly<{ x: number; y: number; targetId?: string }>;
  speech: Readonly<{ eventId: string | null; phase: SpeechPhase; audioTimeMs: number; mouthOpen: number; mouthForm: number }>;
  action: string;
  intentId: string | null;
  pose: Readonly<Partial<Record<BodyChannel, number>>>;
  wardrobeId: string | null;
}

export interface RendererCapabilities {
  mode: EmbodimentMode;
  rendererId: string;
  channels: readonly BodyChannel[];
  expressions: readonly ExpressionChannel[];
  supportsSpeechVisemes: boolean;
  supportsWorldTargets: boolean;
  supportsClothingLayers: boolean;
  supportsPhysics: boolean;
}

export interface SwitchPlan {
  schemaVersion: 1;
  from: EmbodimentMode;
  to: EmbodimentMode;
  stateRevision: number;
  preserved: SemanticBodyState;
  supportedPose: Partial<Record<BodyChannel, number>>;
  unsupportedChannels: BodyChannel[];
  expressionSupported: boolean;
  speechVisemesSupported: boolean;
  worldTargetSupported: boolean;
  wardrobeSupported: boolean;
  requiresNeutralRebind: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const CHANNELS = new Set<BodyChannel>([
  "headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch",
  "leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist",
  "leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle",
  "leftHand", "rightHand", "leftFingers", "rightFingers", "gazeX", "gazeY", "breath", "rootYaw",
]);
const EXPRESSIONS = new Set<ExpressionChannel>(["neutral", "joy", "sadness", "anger", "anxiety", "curiosity", "protective", "surprise"]);

const isBoundedNonBlankString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

const isNullableIdentifier = (value: unknown, maxLength: number): value is string | null =>
  value === null || isBoundedNonBlankString(value, maxLength);

export function validateSemanticBodyState(value: SemanticBodyState): boolean {
  if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0) return false;
  if (!Number.isFinite(value.capturedAtMonotonicMs) || value.capturedAtMonotonicMs < 0) return false;
  if (!EXPRESSIONS.has(value.emotion) || !Number.isFinite(value.emotionIntensity) || value.emotionIntensity < 0 || value.emotionIntensity > 1) return false;
  if (!isBoundedNonBlankString(value.expression, 96)) return false;
  if (!value.gaze || !Number.isFinite(value.gaze.x) || !Number.isFinite(value.gaze.y) || Math.abs(value.gaze.x) > 1 || Math.abs(value.gaze.y) > 1) return false;
  if (value.gaze.targetId !== undefined && !isBoundedNonBlankString(value.gaze.targetId, 128)) return false;
  if (!value.speech || !["idle", "starting", "speaking", "ended", "cancelled", "unknown"].includes(value.speech.phase)) return false;
  if (!isNullableIdentifier(value.speech.eventId, 128)) return false;
  if (!Number.isFinite(value.speech.audioTimeMs) || value.speech.audioTimeMs < 0 || !Number.isFinite(value.speech.mouthOpen) || value.speech.mouthOpen < 0 || value.speech.mouthOpen > 1 || !Number.isFinite(value.speech.mouthForm) || Math.abs(value.speech.mouthForm) > 1) return false;
  if (!value.pose || Object.entries(value.pose).some(([key, n]) => !CHANNELS.has(key as BodyChannel) || !Number.isFinite(n))) return false;
  return isBoundedNonBlankString(value.action, 96)
    && isNullableIdentifier(value.intentId, 128)
    && isNullableIdentifier(value.wardrobeId, 128);
}

/** Build a truthful handoff plan without mutating the canonical organism snapshot. */
export function planEmbodimentSwitch(
  from: EmbodimentMode,
  capabilities: RendererCapabilities,
  state: SemanticBodyState,
): SwitchPlan {
  if (!validateSemanticBodyState(state)) throw new TypeError("invalid-semantic-body-state");
  if (!capabilities.rendererId.trim() || !Array.isArray(capabilities.channels) || !Array.isArray(capabilities.expressions)) throw new TypeError("invalid-renderer-capabilities");
  if (new Set(capabilities.channels).size !== capabilities.channels.length) throw new TypeError("duplicate-renderer-channel");
  const supported = new Set(capabilities.channels);
  const supportedPose: Partial<Record<BodyChannel, number>> = {};
  const unsupportedChannels: BodyChannel[] = [];
  for (const [key, value] of Object.entries(state.pose) as [BodyChannel, number][]) {
    if (supported.has(key)) supportedPose[key] = value;
    else unsupportedChannels.push(key);
  }
  return {
    schemaVersion: 1, from, to: capabilities.mode, stateRevision: state.revision,
    preserved: structuredCloneSafe(state), supportedPose, unsupportedChannels,
    expressionSupported: capabilities.expressions.includes(state.emotion),
    speechVisemesSupported: capabilities.supportsSpeechVisemes,
    worldTargetSupported: capabilities.supportsWorldTargets && Boolean(state.gaze.targetId),
    wardrobeSupported: capabilities.supportsClothingLayers && Boolean(state.wardrobeId),
    requiresNeutralRebind: from !== capabilities.mode,
  };
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Smoothly blend only channels supported by both endpoints; never invent missing targets. */
export function blendSharedPose(
  from: Readonly<Partial<Record<BodyChannel, number>>>,
  to: Readonly<Partial<Record<BodyChannel, number>>>,
  progress: number,
): Partial<Record<BodyChannel, number>> {
  const t = clamp(progress, 0, 1);
  const result: Partial<Record<BodyChannel, number>> = {};
  for (const key of Object.keys(from) as BodyChannel[]) {
    const a = from[key], b = to[key];
    if (Number.isFinite(a) && Number.isFinite(b)) result[key] = a! + (b! - a!) * t;
  }
  return result;
}

/** Monotonic transition progress; stale frames cannot move a handoff backwards. */
export function advanceSwitchProgress(previous: number, elapsedMs: number, durationMs: number): number {
  const safePrevious = clamp(previous, 0, 1);
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0) return safePrevious;
  return Math.max(safePrevious, clamp(elapsedMs / durationMs, 0, 1));
}
