import type { EmotionLabel } from "@/organism/types";

export type FaceChannel =
  | "blink" | "blinkLeft" | "blinkRight"
  | "browRaise" | "browRaiseLeft" | "browRaiseRight"
  | "browFurrow" | "browFurrowLeft" | "browFurrowRight"
  | "eyeLookXLeft" | "eyeLookXRight" | "eyeLookYLeft" | "eyeLookYRight"
  | "smile" | "frown" | "mouthOpen" | "mouthWide" | "mouthRound"
  | "visemeAA" | "visemeEE" | "visemeIH" | "visemeOH" | "visemeOU"
  | "visemeFV" | "visemeMBP" | "visemeL"
  | "joy" | "sadness" | "anger" | "anxiety";

export type FaceValues = Record<FaceChannel, number>;
export type SpeechViseme = "aa" | "ee" | "ih" | "oh" | "ou" | "fv" | "mbp" | "l";
export interface FaceIntent {
  emotion: EmotionLabel;
  speaking?: boolean;
  mouthOpen?: number;
  mouthForm?: number;
  blink?: number;
  blinkLeft?: number;
  blinkRight?: number;
  gazeX?: number;
  gazeY?: number;
  viseme?: SpeechViseme | string | null;
  visemeWeight?: number;
  warmth?: number;
  composure?: number;
  thinking?: boolean;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const signed = (value: number) => clamp(value, -1, 1);
const VISEMES: readonly SpeechViseme[] = ["aa", "ee", "ih", "oh", "ou", "fv", "mbp", "l"];

/** Resolve affect, gaze and speech into normalized, renderer-independent face controls. */
export function resolveDepthRigFacePose(intent: FaceIntent): FaceValues {
  const emotion = intent.emotion;
  const speaking = intent.speaking === true;
  const open = speaking ? clamp(intent.mouthOpen ?? 0) : 0;
  const form = clamp(intent.mouthForm ?? 0, -1, 1);
  const blink = clamp(intent.blink ?? 0);
  const blinkLeft = clamp(intent.blinkLeft ?? blink);
  const blinkRight = clamp(intent.blinkRight ?? blink);
  const joy = emotion === "joy" ? 1 : emotion === "protective" ? .22 : 0;
  const sadness = emotion === "sadness" ? .72 : 0;
  const anger = emotion === "anger" || emotion === "frustration" ? .78 : 0;
  const anxiety = emotion === "anxiety" ? .58 : 0;
  const smile = Math.max(joy * .72, emotion === "calm" ? clamp(intent.warmth ?? .5) * .16 : 0);
  const frown = Math.max(sadness * .72, anger * .62, anxiety * .24);
  const browRaise = clamp((emotion === "curiosity" ? .48 : anxiety * .3) + (intent.thinking ? .12 : 0));
  const browFurrow = clamp(anger * .82 + (intent.thinking ? .08 : 0));
  const visemeWeight = speaking ? clamp(intent.visemeWeight ?? open) : 0;
  const activeViseme = typeof intent.viseme === "string" && VISEMES.includes(intent.viseme.toLowerCase() as SpeechViseme)
    ? intent.viseme.toLowerCase() as SpeechViseme : null;
  const viseme = (key: SpeechViseme) => activeViseme === key ? visemeWeight : 0;
  return {
    blink, blinkLeft, blinkRight,
    browRaise, browRaiseLeft: clamp(browRaise * 1.04), browRaiseRight: clamp(browRaise * .96),
    browFurrow, browFurrowLeft: clamp(browFurrow * .98), browFurrowRight: clamp(browFurrow * 1.02),
    eyeLookXLeft: signed(intent.gazeX ?? 0), eyeLookXRight: signed(intent.gazeX ?? 0),
    eyeLookYLeft: signed(intent.gazeY ?? 0), eyeLookYRight: signed(intent.gazeY ?? 0),
    smile, frown, mouthOpen: open,
    mouthWide: speaking && form > .25 ? open * clamp(form) : 0,
    mouthRound: speaking && form < -.25 ? open * clamp(-form) : 0,
    visemeAA: viseme("aa"), visemeEE: viseme("ee"), visemeIH: viseme("ih"),
    visemeOH: viseme("oh"), visemeOU: viseme("ou"), visemeFV: viseme("fv"),
    visemeMBP: viseme("mbp"), visemeL: viseme("l"),
    joy, sadness, anger, anxiety,
  };
}

/** Frame-rate independent exponential blend for smooth expression/viseme transitions. */
export function blendDepthRigFacePose(
  previous: FaceValues,
  target: FaceValues,
  deltaSeconds: number,
  response = 18,
): FaceValues {
  const dt = clamp(deltaSeconds, 0, .1);
  const rate = clamp(response, 0, 40);
  const alpha = 1 - Math.exp(-rate * dt);
  return Object.fromEntries((Object.keys(target) as FaceChannel[]).map((channel) => [
    channel,
    previous[channel] + (target[channel] - previous[channel]) * alpha,
  ])) as FaceValues;
}

const ALIASES: Record<FaceChannel, readonly string[]> = {
  blink: ["blink", "eyeblink", "eyeclose", "eyesclosed"],
  blinkLeft: ["blinkleft", "eyeblinkleft", "eyecloseleft", "eyelidcloseleft"],
  blinkRight: ["blinkright", "eyeblinkright", "eyecloseright", "eyelidcloseright"],
  browRaise: ["browraise", "eyebrowraise"],
  browRaiseLeft: ["browraiseleft", "eyebrowraiseleft"],
  browRaiseRight: ["browraiseright", "eyebrowraiseright"],
  browFurrow: ["browfurrow", "browdown", "eyebrowdown"],
  browFurrowLeft: ["browfurrowleft", "browdownleft", "eyebrowdownleft"],
  browFurrowRight: ["browfurrowright", "browdownright", "eyebrowdownright"],
  eyeLookXLeft: ["eyelookxleft", "eyegazeleftx", "eyeballleftx"],
  eyeLookXRight: ["eyelookxright", "eyegazerightx", "eyeballrightx"],
  eyeLookYLeft: ["eyelookyright", "eyegazelefty", "eyeballlefty"],
  eyeLookYRight: ["eyelookyright", "eyegazerighty", "eyeballrighty"],
  smile: ["smile", "mouthsmile"],
  frown: ["frown", "mouthfrown"],
  mouthOpen: ["mouthopen", "jawopen", "visemeaa", "phonemeaa"],
  mouthWide: ["visemeih", "phonemeih", "mouthwide"],
  mouthRound: ["visemeoh", "phonemeoh", "mouthround"],
  visemeAA: ["visemeaa", "phonemeaa", "aa"],
  visemeEE: ["visemeee", "phonemeee", "ee"],
  visemeIH: ["visemeih", "phonemeih", "ih"],
  visemeOH: ["visemeoh", "phonemeoh", "oh"],
  visemeOU: ["visemeou", "phonemeou", "ou"],
  visemeFV: ["visemefv", "phonemefv", "fv"],
  visemeMBP: ["visemembp", "phonemembp", "mbp"],
  visemeL: ["visemel", "phonemel", "l"],
  joy: ["happy", "joy"],
  sadness: ["sad", "sorrow", "cry"],
  anger: ["angry", "anger"],
  anxiety: ["anxious", "anxiety"],
};

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Apply uniquely named morph targets. Optional bindings are treated as untrusted
 * asset metadata: malformed entries are ignored, never allowed to throw.
 */
export function applyDepthRigFaceMorphs(
  root: any,
  values: FaceValues,
  bindings: Partial<Record<FaceChannel, readonly string[]>> = {},
): { applied: number; missing: FaceChannel[]; ambiguous: string[] } {
  const names = Object.fromEntries((Object.keys(ALIASES) as FaceChannel[]).map((channel) => {
    const custom = (bindings as any)?.[channel];
    const candidates = Array.isArray(custom) ? custom.filter((name: unknown): name is string => typeof name === "string") : null;
    const aliases = candidates?.length ? candidates : ALIASES[channel];
    return [channel, aliases.map(normalize).filter(Boolean)];
  })) as Record<FaceChannel, string[]>;
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
