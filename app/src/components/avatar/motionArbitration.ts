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
import {
  MOTION_PROGRAMS,
  blendMotionLayers,
  sampleMotionProgram,
  type MotionBlendLayer,
  type MotionProgramId,
  type SemanticGestureProgramId,
} from "./motionLibrary.ts";

export interface MotionIntent {
  action: string;
  emotion: string;
  speaking: boolean;
  thinking: boolean;
  awake: boolean;
  energy01: number;
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

/**
 * Deterministic intent-to-primary mapping. Speech and explicit thinking take
 * precedence over the emotion default, and an explicit action overrides both.
 */
export function resolvePrimaryProgram(intent: MotionIntent): MotionProgramId {
  const awake = intent.awake !== false;
  if (!awake) return "idle";
  if (intent.thinking) return "think";
  if (intent.gestureProgram && ["nod", "shake", "wave", "clap", "bow"].includes(intent.gestureProgram)) return intent.gestureProgram;
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
    && (intent.allowLocomotion === undefined || typeof intent.allowLocomotion === "boolean")
    && (intent.gestureProgram === undefined || ["nod", "shake", "wave", "clap", "bow"].includes(intent.gestureProgram));
}

const MOTION_PROGRAM_IDS: ReadonlySet<string> = new Set(Object.keys(MOTION_PROGRAMS));

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
