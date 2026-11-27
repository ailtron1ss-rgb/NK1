export interface GlbFacialMorphFrame {
  emotion: string;
  gazeX: number;
  /** In NK1's current projection, positive gazeY means looking down. */
  gazeY: number;
  energy: number;
  cognitiveLoad: number;
  uncertainty: number;
  novelty: number;
  curiosity: number;
  valence: number;
  sarcasm: number;
  speaking: boolean;
  mouthOpen: number;
  thinking: boolean;
  awake: boolean;
  blink: boolean;
  browRaise?: number;
  browFurrow?: number;
  winkLeft?: number;
  winkRight?: number;
}

export interface GlbFacialMorphWeight {
  index: number;
  value: number;
}

const clamp01 = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const clampSigned = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function emotionWeight(emotion: string, aliases: readonly string[]): number {
  return aliases.includes(emotion) ? 1 : 0;
}

/**
 * Translate canonical NK1 affect, speech and gaze into the optional facial
 * morph targets exported by the Kurisu GLB. Unknown targets are ignored, while
 * every recognized target is explicitly reset each frame to prevent stale poses.
 *
 * This adapter operates only on generic GLB morph targets; VRM expressionManager
 * remains owned by vrmRuntimeAdapter.
 */
export function resolveGlbFacialMorphWeights(
  dictionary: unknown,
  frame: GlbFacialMorphFrame,
): GlbFacialMorphWeight[] {
  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary) || !frame) return [];
  const entries = Object.entries(dictionary as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isSafeInteger(entry[1]) && entry[1] >= 0,
  );
  if (!entries.length) return [];

  const emotion = typeof frame.emotion === "string" ? frame.emotion : "calm";
  const joy = emotionWeight(emotion, ["joy"]);
  const sadness = emotionWeight(emotion, ["sadness"]);
  const anger = emotionWeight(emotion, ["anger", "frustration"]);
  const anxiety = emotionWeight(emotion, ["anxiety"]);
  const curiosity = Math.max(
    emotionWeight(emotion, ["curiosity"]),
    clamp01(frame.curiosity) * 0.72,
    clamp01(frame.novelty) * 0.30,
  );
  const surprised = Math.max(
    emotionWeight(emotion, ["surprise"]),
    curiosity * 0.62,
    clamp01(frame.uncertainty) * 0.20,
  );
  const valence = clamp01(frame.valence);
  const sarcasm = clamp01(frame.sarcasm);
  const load = clamp01(frame.cognitiveLoad);
  const energy = clamp01(frame.energy);
  const speaking = frame.speaking === true;
  const awake = frame.awake === true;
  const mouthOpen = speaking ? clamp01(frame.mouthOpen) : 0;
  const blink = awake && frame.blink === true ? 1 : 0;
  const gazeX = clampSigned(frame.gazeX);
  const gazeY = clampSigned(frame.gazeY);

  const values: Record<string, number> = {
    happy: Math.max(joy * (0.76 + 0.24 * valence), emotionWeight(emotion, ["protective"]) * 0.18),
    joy: joy,
    smile: Math.max(joy * 0.82, emotionWeight(emotion, ["protective"]) * 0.14),
    grin: joy * (0.35 + 0.45 * valence),
    sad: Math.max(sadness, anxiety * 0.55),
    sorrow: sadness,
    cry: sadness * 0.35,
    worried: Math.max(anxiety, sadness * 0.35),
    angry: anger * 0.9,
    anger: anger,
    frown: Math.max(anger * 0.65, anxiety * 0.18),
    surprised,
    curious: curiosity,
    smirkleft: sarcasm * 0.72,
    smirkright: sarcasm * 0.28,
    pout: Math.max(sadness * 0.55, anxiety * 0.45, (1 - valence) * 0.18),
    browraise: Math.max(clamp01(frame.browRaise), surprised * 0.72),
    browfurrow: Math.max(clamp01(frame.browFurrow), anger * 0.72, load * 0.22),
    browconcern: Math.max(anxiety, sadness * 0.58),
    browsurprise: surprised,
    browskeptic: sarcasm * 0.65,
    browfocus: frame.thinking === true ? 0.42 + load * 0.42 : load * 0.12,
    eyesquint: Math.max(anger * 0.34, sarcasm * 0.2),
    eyewide: surprised * (0.66 + energy * 0.22),
    blink,
    winkleft: clamp01(frame.winkLeft),
    winkright: clamp01(frame.winkRight),
    jawopen: mouthOpen,
    mouthopen: mouthOpen,
    gazeleft: Math.max(0, -gazeX),
    gazeright: Math.max(0, gazeX),
    gazeup: Math.max(0, -gazeY),
    gazedown: Math.max(0, gazeY),
  };

  const result: GlbFacialMorphWeight[] = [];
  const seen = new Set<number>();
  for (const [name, index] of entries) {
    const normalized = normalize(name);
    const value = values[normalized];
    if (value === undefined || seen.has(index)) continue;
    seen.add(index);
    result.push({ index, value: clamp01(value) });
  }
  return result;
}
