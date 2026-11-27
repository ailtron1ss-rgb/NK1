/**
 * NK1 motion arbitration: turn a cognitive intent into a bounded, blended set of
 * motion programs (aspect 11 / motor).
 *
 * This is the single place that decides which whole-body movements play. It maps
 * action/emotion/speech context to a primary program, keeps a continuous idle
 * breathing layer so the body never freezes, and cross-fades on a bounded
 * transition instead of hard-cutting. It emits renderer-neutral channel targets
 * and never claims a renderer applied them.
 *
 * It deliberately does not own affect, goals or memory: those arrive as an
 * already-computed intent. Locomotion (walk) stays behind an explicit policy flag
 * because a panel avatar must not silently walk off screen.
 */
import type { BodyChannel } from "./embodimentSwitch.ts";
import type { AvatarMotorAction } from "./motorIntent.ts";
import {
  MOTION_PROGRAMS,
  blendMotionLayers,
  sampleMotionProgram,
  type MotionBlendLayer,
  type MotionProgramId,
  type SemanticGestureProgramId,
} from "./motionLibrary.ts";

export interface MotionCharacterContext {
  valence01: number;
  arousal01: number;
  dominance01: number;
  curiosity01: number;
  warmth01: number;
  stress01: number;
  confidence01: number;
  memoryRecall01: number;
  cognitiveLoad01: number;
  uncertainty01: number;
  socialNeed01: number;
  novelty01: number;
  goalPressure01: number;
  predictionError01: number;
  traits: Readonly<{
    curiosity: number;
    warmth: number;
    guardedness: number;
    composure: number;
    playfulness: number;
    sarcasm: number;
  }>;
  reducedMotion: boolean;
}

export interface MotionIntent {
  action: string;
  emotion: string;
  speaking: boolean;
  thinking: boolean;
  awake: boolean;
  energy01: number;
  /** Output of the single cognitive/personality motor planner; overrides stale raw action labels. */
  semanticAction?: AvatarMotorAction;
  /** Same-tick organism affect, homeostatic needs and stable identity traits. */
  character?: MotionCharacterContext;
  /** Opt-in locomotion; disabled by default so a panel avatar never walks away. */
  allowLocomotion?: boolean;
  /** Explicit, short-lived action-card gesture from a closed assistant stage direction. */
  gestureProgram?: SemanticGestureProgramId;
}

export interface MotionLayerState {
  programId: MotionProgramId;
  timeMs: number;
  weight: number;
}

export interface MotionArbitrationState {
  schemaVersion: 1;
  layers: MotionLayerState[];
  primary: MotionProgramId | null;
  /** Milliseconds into the current primary transition, 0 when settled. */
  transitionElapsedMs: number;
  transitioning: boolean;
}

export interface MotionArbitrationResult {
  state: MotionArbitrationState;
  channels: Partial<Record<BodyChannel, number>>;
  primary: MotionProgramId;
  blendedChannels: BodyChannel[];
}

export const MOTION_TRANSITION_MS = 260;
const IDLE_BREATH_WEIGHT = 0.4;
const MAX_LAYERS = 3;
const EXPLICIT_GESTURE_PROGRAMS: ReadonlySet<SemanticGestureProgramId> = new Set(["nod", "shake", "wave", "clap", "bow", "point"]);

const clamp01 = (value: unknown): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : 0;

export function defaultMotionArbitrationState(): MotionArbitrationState {
  return { schemaVersion: 1, layers: [], primary: null, transitionElapsedMs: 0, transitioning: false };
}

const EMOTION_PRIMARY: Readonly<Record<string, MotionProgramId>> = {
  joy: "respond",
  sadness: "concern",
  anxiety: "concern",
  anger: "respond",
  frustration: "respond",
  protective: "comfort",
  curiosity: "listen",
  calm: "idle",
};

const SEMANTIC_ACTION_PROGRAM: Readonly<Record<AvatarMotorAction, MotionProgramId>> = {
  rest: "idle",
  listen: "listen",
  inspect: "inspect",
  reflect: "think",
  explain: "explain",
  comfort: "comfort",
  respond: "respond",
};

const CHARACTER_SIGNAL_KEYS = [
  "valence01", "arousal01", "dominance01", "curiosity01", "warmth01", "stress01",
  "confidence01", "memoryRecall01", "cognitiveLoad01", "uncertainty01", "socialNeed01",
  "novelty01", "goalPressure01", "predictionError01",
] as const;
const CHARACTER_TRAIT_KEYS = ["curiosity", "warmth", "guardedness", "composure", "playfulness", "sarcasm"] as const;

function validateCharacterContext(value: unknown): value is MotionCharacterContext {
  if (!isPlainRecord(value)) return false;
  const expectedKeys = [...CHARACTER_SIGNAL_KEYS, "traits", "reducedMotion"];
  const ownKeys = Object.keys(value);
  if (ownKeys.length !== expectedKeys.length || !expectedKeys.every((key) => Object.hasOwn(value, key))) return false;
  for (const key of CHARACTER_SIGNAL_KEYS) {
    const signal = ownData(value, key);
    if (typeof signal !== "number" || !Number.isFinite(signal) || signal < 0 || signal > 1) return false;
  }
  if (typeof ownData(value, "reducedMotion") !== "boolean") return false;
  const traits = ownData(value, "traits");
  if (!isPlainRecord(traits)) return false;
  const traitKeys = Object.keys(traits);
  if (traitKeys.length !== CHARACTER_TRAIT_KEYS.length
    || !CHARACTER_TRAIT_KEYS.every((key) => Object.hasOwn(traits, key))) return false;
  return CHARACTER_TRAIT_KEYS.every((key) => {
    const trait = ownData(traits, key);
    return typeof trait === "number" && Number.isFinite(trait) && trait >= 0 && trait <= 1;
  });
}

/**
 * Deterministic intent-to-primary mapping. Speech and explicit thinking take
 * precedence over the emotion default, and an explicit action overrides both.
 */
export function resolvePrimaryProgram(intent: MotionIntent): MotionProgramId {
  const awake = intent.awake !== false;
  if (!awake) return "idle";
  if (intent.thinking) return "think";
  if (intent.gestureProgram && EXPLICIT_GESTURE_PROGRAMS.has(intent.gestureProgram)) return intent.gestureProgram;
  if (intent.semanticAction) return SEMANTIC_ACTION_PROGRAM[intent.semanticAction];
  if (intent.speaking && intent.action === "respond") return "respond";
  switch (intent.action) {
    case "explore":
      return intent.allowLocomotion === true ? "walk" : "explain";
    case "verify":
    case "reflect":
      return "think";
    case "respond":
      return intent.speaking ? "respond" : (EMOTION_PRIMARY[intent.emotion] ?? "respond");
    case "rest":
    case "wait":
      return "idle";
    default:
      return EMOTION_PRIMARY[intent.emotion] ?? "idle";
  }
}

function validateIntent(intent: MotionIntent): boolean {
  return Boolean(intent)
    && typeof intent.action === "string" && intent.action.length <= 96
    && typeof intent.emotion === "string" && intent.emotion.length <= 64
    && typeof intent.speaking === "boolean"
    && typeof intent.thinking === "boolean"
    && typeof intent.awake === "boolean"
    && (intent.semanticAction === undefined || Object.hasOwn(SEMANTIC_ACTION_PROGRAM, intent.semanticAction))
    && (intent.character === undefined || validateCharacterContext(intent.character))
    && (intent.allowLocomotion === undefined || typeof intent.allowLocomotion === "boolean")
    && (intent.gestureProgram === undefined || EXPLICIT_GESTURE_PROGRAMS.has(intent.gestureProgram));
}

const MOTION_PROGRAM_IDS: ReadonlySet<string> = new Set(Object.keys(MOTION_PROGRAMS));

/**
 * Tiny renderer-neutral posture offsets from affect/homeostasis/identity.
 * They are additive to the selected gesture, not a competing motion program.
 * The scale is deliberately restrained so the authored motion remains legible.
 */
function deriveCharacterBodyOffsets(intent: MotionIntent): Partial<Record<BodyChannel, number>> {
  const character = intent.character;
  if (!character || character.reducedMotion || !intent.awake || intent.energy01 <= 0.12
    || intent.semanticAction === "rest") return {};

  const trait = character.traits;
  const curiosity = clamp01(character.curiosity01 * 0.65 + trait.curiosity * 0.35);
  const warmth = clamp01(character.warmth01 * 0.65 + trait.warmth * 0.35);
  const stress = clamp01(character.stress01 * 0.55 + character.cognitiveLoad01 * 0.2
    + character.uncertainty01 * 0.15 + character.predictionError01 * 0.1);
  const confidence = character.confidence01;
  const approach = clamp01(curiosity * 0.32 + warmth * 0.22 + confidence * 0.18
    + character.novelty01 * 0.16 + character.socialNeed01 * 0.12);
  const restraint = clamp01(stress * 0.45 + trait.guardedness * 0.3
    + (1 - character.dominance01) * 0.1 + (1 - trait.composure) * 0.15);
  const openness = Math.max(-1, Math.min(1, approach - restraint));
  const regulation = 0.65 + trait.composure * 0.35;
  const energy = 0.55 + clamp01(intent.energy01) * 0.45;

  return {
    headYaw: Math.max(-0.04, Math.min(0.04, (curiosity - 0.5) * 0.045
      + (character.dominance01 - 0.5) * 0.018)) * regulation * energy,
    headPitch: Math.max(-0.06, Math.min(0.06, (curiosity - 0.5) * 0.05
      + openness * 0.032 + (character.arousal01 - 0.5) * 0.012)) * regulation * energy,
    headRoll: Math.max(-0.05, Math.min(0.05, (warmth - 0.5) * 0.04
      + (trait.playfulness - 0.5) * 0.022 - (trait.guardedness - 0.5) * 0.018
      + (character.valence01 - 0.5) * 0.012)) * regulation * energy,
    torsoYaw: Math.max(-0.04, Math.min(0.04, (character.dominance01 - 0.5) * 0.035
      + (trait.sarcasm - 0.5) * 0.01)) * regulation * energy,
    torsoPitch: Math.max(-0.06, Math.min(0.06, openness * 0.045
      + (character.goalPressure01 - 0.5) * 0.012
      - (character.memoryRecall01 - 0.5) * 0.008)) * regulation * energy,
    leftShoulder: Math.max(-0.045, Math.min(0.045, (stress - 0.4) * 0.035
      + (trait.guardedness - 0.5) * 0.018 - (warmth - 0.5) * 0.025)) * regulation * energy,
    rightShoulder: Math.max(-0.045, Math.min(0.045, (stress - 0.4) * 0.035
      + (trait.guardedness - 0.5) * 0.018 - (warmth - 0.5) * 0.025
      + (trait.playfulness - 0.5) * 0.008)) * regulation * energy,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownData(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize persisted arbitration state before it reaches the frame loop.
 * Invalid/unknown layers are dropped; malformed snapshots reset to a safe idle
 * state instead of crashing the renderer or injecting unbounded motion weights.
 */
export function restoreMotionArbitrationState(raw: unknown): MotionArbitrationState {
  if (!isPlainRecord(raw) || ownData(raw, "schemaVersion") !== 1) return defaultMotionArbitrationState();
  const rawLayers = ownData(raw, "layers");
  const layers: MotionLayerState[] = [];
  const seen = new Set<string>();
  if (Array.isArray(rawLayers)) {
    for (const candidate of rawLayers) {
      if (!isPlainRecord(candidate)) continue;
      const programId = ownData(candidate, "programId");
      const timeMs = ownData(candidate, "timeMs");
      const weight = ownData(candidate, "weight");
      if (typeof programId !== "string" || !MOTION_PROGRAM_IDS.has(programId) || seen.has(programId)) continue;
      if (typeof timeMs !== "number" || !Number.isFinite(timeMs) || timeMs < 0) continue;
      if (typeof weight !== "number" || !Number.isFinite(weight)) continue;
      seen.add(programId);
      layers.push({
        programId: programId as MotionProgramId,
        timeMs: Math.min(timeMs, 1_000_000_000),
        weight: Math.max(0, Math.min(1, weight)),
      });
      if (layers.length >= MAX_LAYERS) break;
    }
  }

  const rawPrimary = ownData(raw, "primary");
  const primary = typeof rawPrimary === "string" && MOTION_PROGRAM_IDS.has(rawPrimary)
    && layers.some((layer) => layer.programId === rawPrimary)
    ? rawPrimary as MotionProgramId
    : null;
  const elapsed = ownData(raw, "transitionElapsedMs");
  const requestedTransition = ownData(raw, "transitioning") === true;
  const elapsedValid = typeof elapsed === "number" && Number.isFinite(elapsed) && elapsed >= 0;
  const safeElapsed = elapsedValid
    ? Math.min(MOTION_TRANSITION_MS, elapsed as number)
    : 0;
  const transitioning = requestedTransition && elapsedValid && primary !== null && safeElapsed < MOTION_TRANSITION_MS;
  if (primary !== null && requestedTransition && !transitioning) {
    const primaryLayer = layers.find((layer) => layer.programId === primary)!;
    primaryLayer.weight = 1;
    return { schemaVersion: 1, layers: [primaryLayer], primary, transitionElapsedMs: 0, transitioning: false };
  }
  return {
    schemaVersion: 1,
    layers,
    primary,
    transitionElapsedMs: transitioning ? safeElapsed : 0,
    transitioning,
  };
}

/**
 * Advance one arbitration step. `deltaMs` is monotonic frame time since the last
 * step; non-positive or non-finite values advance nothing rather than jumping.
 */
export function arbitrateMotion(
  previous: MotionArbitrationState | null,
  intent: MotionIntent,
  deltaMs: number,
): MotionArbitrationResult {
  if (!validateIntent(intent)) throw new TypeError("invalid-motion-intent");
  const state = restoreMotionArbitrationState(previous);
  const step = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, 250) : 0;

  // Advance every live layer's clock first so idle breathing stays continuous.
  for (const layer of state.layers) layer.timeMs += step;

  const desired = resolvePrimaryProgram(intent);
  if (state.primary !== desired) {
    const existing = state.layers.find((layer) => layer.programId === desired);
    if (!existing) {
      state.layers.push({ programId: desired, timeMs: 0, weight: 0 });
    } else {
      existing.timeMs = 0;
      existing.weight = 0;
    }
    state.primary = desired;
    state.transitioning = true;
    state.transitionElapsedMs = 0;
  }

  if (state.transitioning) {
    state.transitionElapsedMs += step;
    const t = Math.max(0, Math.min(1, state.transitionElapsedMs / MOTION_TRANSITION_MS));
    for (const layer of state.layers) layer.weight = layer.programId === desired ? t : 1 - t;
    if (t >= 1) {
      state.layers = state.layers.filter((layer) => layer.programId === desired);
      state.layers[0]!.weight = 1;
      state.transitioning = false;
      state.transitionElapsedMs = 0;
    }
  }

  // Keep a continuous idle breath layer unless idle is itself the primary.
  if (desired !== "idle" && !state.layers.some((layer) => layer.programId === "idle")) {
    state.layers.push({ programId: "idle", timeMs: 0, weight: IDLE_BREATH_WEIGHT });
  }

  // Bound the layer count deterministically: keep the primary and drop the
  // lowest-weight non-primary layers. The primary must sort first, otherwise a
  // rapid sequence of intents can trim the very program that should dominate.
  if (state.layers.length > MAX_LAYERS) {
    state.layers.sort((a, b) => (a.programId === desired ? 0 : 1) - (b.programId === desired ? 0 : 1) || b.weight - a.weight);
    state.layers = state.layers.slice(0, MAX_LAYERS);
  }

  const energyScale = 0.55 + clamp01(intent.energy01) * 0.45;
  const gestureLayers: MotionBlendLayer[] = state.layers
    .filter((layer) => layer.programId !== "idle")
    .map((layer) => ({
      program: MOTION_PROGRAMS[layer.programId],
      timeMs: layer.timeMs,
      weight: layer.weight * energyScale,
    }));
  const idleLayer = state.layers.find((layer) => layer.programId === "idle");
  const blended = blendMotionLayers(gestureLayers.length ? gestureLayers : [{ program: MOTION_PROGRAMS.idle, timeMs: idleLayer?.timeMs ?? 0, weight: 1 }]);
  // Scale gesture amplitude by energy, then overlay breathing additively so a
  // continuous idle breath never dilutes the active gesture's channel values.
  const channels: Partial<Record<BodyChannel, number>> = {};
  for (const [channel, value] of Object.entries(blended.channels) as [BodyChannel, number][]) {
    channels[channel] = Math.max(-1, Math.min(1, value * energyScale));
  }
  if (idleLayer && state.primary !== "idle") {
    const breath = sampleMotionProgram(MOTION_PROGRAMS.idle, idleLayer.timeMs).channels.breath ?? 0;
    // Scale the overlay by the layer's real blend weight (not the raw breath
    // constant) so it fades in and out with the rest of the blend.
    channels.breath = Math.max(-1, Math.min(1, (channels.breath ?? 0) + breath * idleLayer.weight * energyScale));
  }

  // Character-conditioned posture is a small additive layer around the selected
  // motor program. It never creates a second action or overrides explicit gestures.
  for (const [channel, offset] of Object.entries(deriveCharacterBodyOffsets(intent)) as [BodyChannel, number][]) {
    channels[channel] = Math.max(-1, Math.min(1, (channels[channel] ?? 0) + offset));
  }

  return {
    state,
    channels,
    primary: desired,
    blendedChannels: blended.blendedChannels,
  };
}

/** Sample the current primary program's channels directly (diagnostics/tests). */
export function samplePrimaryProgram(programId: MotionProgramId, timeMs: number): Partial<Record<BodyChannel, number>> {
  return sampleMotionProgram(MOTION_PROGRAMS[programId], timeMs).channels;
}
