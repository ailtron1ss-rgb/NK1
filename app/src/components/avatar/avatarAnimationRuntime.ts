/**
 * Deterministic mapping from NK1 cognitive actions to the animation clips carried
 * by a loaded avatar. The controller cross-fades clips instead of stopping the
 * mixer, so breathing and gestures do not snap when the selected action changes.
 *
 * The v7 Kurisu GLB is the primary profile this resolver targets:
 * idle_breathing, talk_gesture, thinking_pose and explore_turn.
 */

export interface AvatarAnimationClipLike {
  name?: string;
}

export interface AvatarAnimationActionLike {
  reset(): this;
  play(): this;
  fadeIn(durationSeconds: number): this;
  crossFadeTo(nextAction: AvatarAnimationActionLike, durationSeconds: number, warp: boolean): this;
  setEffectiveTimeScale(scale: number): this;
  setEffectiveWeight(weight: number): this;
}

export interface AvatarAnimationMixerLike {
  clipAction(clip: AvatarAnimationClipLike): AvatarAnimationActionLike;
}

export interface ResolveAvatarAnimationResult {
  clip: AvatarAnimationClipLike | null;
  clipName: string;
  requestedAction: string;
  resolvedAction: string;
  matchedBy: "preferred-name" | "semantic-name" | "idle-fallback" | "rig-fallback" | "none";
}

export interface ApplyAvatarAnimationInput {
  mixer: AvatarAnimationMixerLike;
  clips: readonly AvatarAnimationClipLike[];
  action: string;
  previousAction: AvatarAnimationActionLike | null;
  previousClipName: string;
  awake: boolean;
  energy: number;
  fadeSeconds?: number;
}

export interface ApplyAvatarAnimationResult {
  activeAction: AvatarAnimationActionLike | null;
  clipName: string;
  changed: boolean;
  resolved: ResolveAvatarAnimationResult;
  timeScale: number;
}

const ACTION_PREFERENCES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  respond: ["talk_gesture", "talk", "speak", "gesture", "explain", "wave"],
  explore: ["explore_turn", "explore", "look", "walk", "turn", "inspect"],
  verify: ["thinking_pose", "think", "inspect", "focus", "work", "write"],
  reflect: ["thinking_pose", "think", "ponder", "reflect", "idle"],
  rest: ["idle_breathing", "idle", "breath", "rest", "sit"],
  wait: ["idle_breathing", "idle", "breath", "stand"],
});

const normalize = (value: unknown): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const finiteUnit = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function matchPreferred(
  clips: readonly AvatarAnimationClipLike[],
  preferences: readonly string[],
): AvatarAnimationClipLike | null {
  for (const preferred of preferences) {
    const expected = normalize(preferred);
    const match = clips.find((clip) => normalize(clip.name) === expected);
    if (match) return match;
  }
  return null;
}

/** Resolve only a clip with a semantic relationship to the requested action. */
export function resolveAvatarAnimationClip(
  clips: readonly AvatarAnimationClipLike[],
  action: string,
): ResolveAvatarAnimationResult {
  const requestedAction = typeof action === "string" ? action : "wait";
  const normalizedAction = normalize(requestedAction);
  const preferences = ACTION_PREFERENCES[normalizedAction];
  const preferred = preferences ? matchPreferred(clips, preferences) : null;

  if (preferred) {
    const resolvedAction = normalizedAction === "verify" || normalizedAction === "reflect"
      ? "reflect"
      : normalizedAction === "rest" || normalizedAction === "wait"
        ? "rest"
        : normalizedAction;
    return {
      clip: preferred,
      clipName: String(preferred.name ?? ""),
      requestedAction,
      resolvedAction,
      matchedBy: "preferred-name",
    };
  }

  const semanticPatterns: Readonly<Record<string, RegExp>> = {
    respond: /talk|speak|gesture|explan|wave/i,
    explore: /explore|turn|walk|look|inspect/i,
    verify: /think|ponder|inspect|focus|work|write/i,
    reflect: /think|ponder|reflect/i,
    rest: /idle|rest|breath|sit/i,
    wait: /idle|stand|breath/i,
  };
  const semantic = clips.find((clip) => semanticPatterns[normalizedAction]?.test(String(clip.name ?? "")));
  if (semantic) {
    return {
      clip: semantic,
      clipName: String(semantic.name ?? ""),
      requestedAction,
      resolvedAction: normalizedAction,
      matchedBy: "semantic-name",
    };
  }

  const idle = clips.find((clip) => /idle|breath|stand/i.test(String(clip.name ?? "")));
  if (idle) {
    return {
      clip: idle,
      clipName: String(idle.name ?? ""),
      requestedAction,
      resolvedAction: "rest",
      matchedBy: "idle-fallback",
    };
  }

  const rigFallback = clips.find((clip) => /rig[_-]?kurisu/i.test(String(clip.name ?? "")));
  if (rigFallback) {
    return {
      clip: rigFallback,
      clipName: String(rigFallback.name ?? ""),
      requestedAction,
      resolvedAction: "rest",
      matchedBy: "rig-fallback",
    };
  }

  return {
    clip: null,
    clipName: "",
    requestedAction,
    resolvedAction: "none",
    matchedBy: "none",
  };
}

/**
 * Apply one animation decision to the active Three.js mixer. Repeated organism
 * ticks for the same semantic clip only update speed; they never restart it.
 * Sleeping bodies use the idle clip regardless of a stale action snapshot.
 */
export function applyAvatarAnimationFrame(input: ApplyAvatarAnimationInput): ApplyAvatarAnimationResult {
  const requestedAction = input.awake ? input.action : "rest";
  const resolved = resolveAvatarAnimationClip(input.clips, requestedAction);
  const energy = finiteUnit(input.energy);
  const timeScale = input.awake ? 0.72 + energy * 0.38 : 0.32 + energy * 0.12;
  const previous = input.previousAction;

  if (!resolved.clip) {
    return {
      activeAction: previous,
      clipName: input.previousClipName,
      changed: false,
      resolved,
      timeScale,
    };
  }

  if (resolved.clipName === input.previousClipName && previous) {
    previous.setEffectiveTimeScale(timeScale);
    return {
      activeAction: previous,
      clipName: resolved.clipName,
      changed: false,
      resolved,
      timeScale,
    };
  }

  const next = input.mixer.clipAction(resolved.clip);
  next.reset();
  next.setEffectiveTimeScale(timeScale);
  next.setEffectiveWeight(1);

  const fadeSeconds = Number.isFinite(input.fadeSeconds)
    ? Math.max(0.05, Math.min(0.8, Number(input.fadeSeconds)))
    : 0.24;

  if (previous) previous.crossFadeTo(next, fadeSeconds, false);
  else next.fadeIn(fadeSeconds);
  next.play();

  return {
    activeAction: next,
    clipName: resolved.clipName,
    changed: true,
    resolved,
    timeScale,
  };
}
