import type { EmotionLabel } from "@/organism/types";

export type FaceChannel =
  | "blink" | "browRaise" | "browFurrow" | "smile" | "frown"
  | "mouthOpen" | "mouthWide" | "mouthRound" | "joy" | "sadness"
  | "anger" | "anxiety";

export type FaceValues = Record<FaceChannel, number>;
export interface FaceIntent {
  emotion: EmotionLabel;
  speaking?: boolean;
  mouthOpen?: number;
  mouthForm?: number;
  blink?: number;
  warmth?: number;
  composure?: number;
  thinking?: boolean;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/** Resolve organism affect and speech into normalized, renderer-independent face controls. */
export function resolveDepthRigFacePose(intent: FaceIntent): FaceValues {
  const emotion = intent.emotion;
  const speaking = intent.speaking === true;
  const open = speaking ? clamp(intent.mouthOpen ?? 0) : 0;
  const form = clamp(intent.mouthForm ?? 0, -1, 1);
  const blink = clamp(intent.blink ?? 0);
  const joy = emotion === "joy" ? 1 : emotion === "protective" ? .22 : 0;
  const sadness = emotion === "sadness" ? .72 : 0;
  const anger = emotion === "anger" || emotion === "frustration" ? .78 : 0;
  const anxiety = emotion === "anxiety" ? .58 : 0;
  const smile = Math.max(joy * .72, emotion === "calm" ? clamp(intent.warmth ?? .5) * .16 : 0);
  const frown = Math.max(sadness * .72, anger * .62, anxiety * .24);
  return {
    blink,
    browRaise: clamp((emotion === "curiosity" ? .48 : anxiety * .3) + (intent.thinking ? .12 : 0)),
    browFurrow: clamp(anger * .82 + (intent.thinking ? .08 : 0)),
    smile,
    frown,
    mouthOpen: open,
    mouthWide: speaking && form > .25 ? open * clamp(form) : 0,
    mouthRound: speaking && form < -.25 ? open * clamp(-form) : 0,
    joy,
    sadness,
    anger,
    anxiety,
  };
}

const ALIASES: Record<FaceChannel, readonly string[]> = {
  blink: ["blink", "eyeclose", "eyesclosed"],
  browRaise: ["browraise", "eyebrowraise"],
  browFurrow: ["browfurrow", "browdown", "eyebrowdown"],
  smile: ["smile", "mouthsmile"],
  frown: ["frown", "mouthfrown"],
  mouthOpen: ["mouthopen", "jawopen", "visemeaa", "phonemeaa"],
  mouthWide: ["visemeih", "phonemeih", "mouthwide"],
  mouthRound: ["visemeoh", "phonemeoh", "mouthround"],
  joy: ["happy", "joy"],
  sadness: ["sad", "sorrow", "cry"],
  anger: ["angry", "anger"],
  anxiety: ["anxious", "anxiety"],
};

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Apply only recognized, uniquely named morph targets. Missing optional channels
 * are reported but never fail the model; ambiguous normalized names are skipped.
 */
export function applyDepthRigFaceMorphs(
  root: any,
  values: FaceValues,
  bindings: Partial<Record<FaceChannel, readonly string[]>> = {},
): { applied: number; missing: FaceChannel[]; ambiguous: string[] } {
  const names = Object.fromEntries((Object.keys(ALIASES) as FaceChannel[]).map((channel) => [
    channel, (bindings[channel] ?? ALIASES[channel]).map(normalize),
  ])) as Record<FaceChannel, string[]>;
  const found = new Set<FaceChannel>();
  const ambiguous = new Set<string>();
  let applied = 0;
  root?.traverse?.((node: any) => {
    const dictionary = node?.morphTargetDictionary;
    const influences = node?.morphTargetInfluences;
    if (!dictionary || !influences) return;
    const indices = new Map<string, number[]>();
    for (const [name, index] of Object.entries(dictionary)) {
      const key = normalize(name);
      const bucket = indices.get(key) ?? [];
      bucket.push(Number(index));
      indices.set(key, bucket);
    }
    for (const channel of Object.keys(names) as FaceChannel[]) {
      for (const alias of names[channel]) {
        const matches = indices.get(alias);
        if (!matches) continue;
        if (matches.length !== 1 || !Number.isInteger(matches[0]) || matches[0] < 0 || matches[0] >= influences.length) {
          ambiguous.add(alias);
          continue;
        }
        influences[matches[0]] = clamp(values[channel]);
        found.add(channel);
        applied++;
        break;
      }
    }
  });
  return {
    applied,
    missing: (Object.keys(names) as FaceChannel[]).filter((channel) => !found.has(channel)),
    ambiguous: [...ambiguous].sort(),
  };
}
