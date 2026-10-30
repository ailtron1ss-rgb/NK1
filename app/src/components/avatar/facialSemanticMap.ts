/**
 * Cross-format facial expression and viseme semantic mapping.
 *
 * This is a data-only adapter: it does not depend on a specific VRM runtime.
 * Callers provide target morph names/indices and apply the returned weights
 * through their renderer. Speech visemes are resolved separately so they can
 * retain priority over idle/static mouth expressions.
 */

export type FacialSemantic =
  | "neutral" | "happy" | "sad" | "angry" | "relaxed" | "surprised"
  | "blink" | "blinkLeft" | "blinkRight" | "lookUp" | "lookDown"
  | "lookLeft" | "lookRight" | "aa" | "ih" | "ou" | "ee" | "oh";

export type FacialTarget = Readonly<{
  name: string;
  index: number;
}>;

export type FacialBinding = Readonly<{
  semantic: FacialSemantic;
  target: FacialTarget;
  sourceName: string;
  confidence: number;
}>;

export type FacialWeight = Readonly<{
  semantic: FacialSemantic;
  weight: number;
}>;

export type FacialResolveOptions = Readonly<{
  /** Prefer exact VRM names before normalized aliases. Defaults to true. */
  preferExact?: boolean;
  /** Maximum number of morph channels returned. Defaults to 64. */
  maxBindings?: number;
}>;

const ALIASES: Readonly<Record<FacialSemantic, readonly string[]>> = {
  neutral: ["neutral", "default", "normal", "base"],
  happy: ["happy", "joy", "smile", "smiling", "fun", "delight"],
  sad: ["sad", "sorrow", "blue", "cry", "frown"],
  angry: ["angry", "怒り", "anger", "mad", "rage"],
  relaxed: ["relaxed", "calm", "soft", "gentle"],
  surprised: ["surprised", "surprise", "astonished", "shock"],
  blink: ["blink", "eyeclose", "eyesclosed", "closeeyes"],
  blinkLeft: ["blinkleft", "eyecloseleft", "lefteyeclose", "winkleft"],
  blinkRight: ["blinkright", "eyecloseright", "righteyeclose", "winkright"],
  lookUp: ["lookup", "eyesup", "gazeup"],
  lookDown: ["lookdown", "eyesdown", "gazedown"],
  lookLeft: ["lookleft", "eyesleft", "gazeleft"],
  lookRight: ["lookright", "eyesright", "gazeright"],
  aa: ["aa", "a", "vrcv_aa", "viseme_aa", "mouthaa"],
  ih: ["ih", "i", "vrcv_ih", "viseme_ih", "mouthih"],
  ou: ["ou", "u", "vrcv_ou", "viseme_ou", "mouthou"],
  ee: ["ee", "e", "vrcv_e", "viseme_ee", "viseme_e", "mouthee"],
  oh: ["oh", "o", "vrcv_oh", "viseme_oh", "viseme_o", "mouthoh"],
};

const VRM0_NAMES: Readonly<Record<string, FacialSemantic>> = {
  joy: "happy", sorrow: "sad", angry: "angry", fun: "relaxed",
  a: "aa", i: "ih", u: "ou", e: "ee", o: "oh",
  blink: "blink", blink_l: "blinkLeft", blink_r: "blinkRight",
};

const normalize = (value: string): string =>
  value.normalize("NFKD").toLowerCase().replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const ALIAS_LOOKUP = new Map<string, FacialSemantic>();
for (const [semantic, aliases] of Object.entries(ALIASES) as [FacialSemantic, readonly string[]][]) {
  for (const alias of aliases) ALIAS_LOOKUP.set(normalize(alias), semantic);
}
for (const [name, semantic] of Object.entries(VRM0_NAMES)) ALIAS_LOOKUP.set(normalize(name), semantic);

export function resolveFacialSemantic(name: string): FacialSemantic | undefined {
  if (!name || typeof name !== "string") return undefined;
  return ALIAS_LOOKUP.get(normalize(name));
}

/**
 * Build a stable one-target-per-semantic map. Exact semantic names win;
 * duplicate aliases are resolved by confidence, then lexical target name.
 */
export function buildFacialBindings(
  targets: readonly FacialTarget[],
  options: FacialResolveOptions = {},
): readonly FacialBinding[] {
  const maxBindings = Math.max(1, Math.min(256, Math.floor(options.maxBindings ?? 64)));
  const preferExact = options.preferExact !== false;
  const best = new Map<FacialSemantic, FacialBinding>();
  for (const target of targets.slice(0, 4096)) {
    if (!target || !Number.isSafeInteger(target.index) || target.index < 0 || !target.name) continue;
    const semantic = resolveFacialSemantic(target.name);
    if (!semantic) continue;
    const normalized = normalize(target.name);
    const confidence = normalized === normalize(semantic) ? 1 : 0.8;
    const candidate: FacialBinding = { semantic, target, sourceName: target.name, confidence };
    const current = best.get(semantic);
    if (!current || (preferExact && confidence > current.confidence)
      || (confidence === current.confidence && target.name.localeCompare(current.sourceName) < 0)) {
      best.set(semantic, candidate);
    }
  }
  return [...best.values()]
    .sort((a, b) => a.semantic.localeCompare(b.semantic))
    .slice(0, maxBindings);
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/**
 * Merge expression weights with speech visemes. Speech wins over mouth-shape
 * expression weights, while eye/face channels remain independent. A caller
 * should feed only the current speech frame (not accumulate frames).
 */
export function composeFacialWeights(
  expressions: readonly FacialWeight[],
  speechVisemes: readonly FacialWeight[] = [],
): ReadonlyMap<FacialSemantic, number> {
  const result = new Map<FacialSemantic, number>();
  for (const item of expressions) {
    if (!item) continue;
    result.set(item.semantic, Math.max(result.get(item.semantic) ?? 0, clamp01(item.weight)));
  }
  const mouth = new Set<FacialSemantic>(["aa", "ih", "ou", "ee", "oh"]);
  for (const item of speechVisemes) {
    if (!item || !mouth.has(item.semantic)) continue;
    result.set(item.semantic, clamp01(item.weight));
  }
  return result;
}

/** Convert semantic weights to target morph-index weights, omitting zeroes. */
export function mapFacialWeightsToTargets(
  bindings: readonly FacialBinding[],
  weights: ReadonlyMap<FacialSemantic, number>,
): ReadonlyMap<number, number> {
  const result = new Map<number, number>();
  for (const binding of bindings) {
    const weight = clamp01(weights.get(binding.semantic) ?? 0);
    if (weight > 0) result.set(binding.target.index, weight);
  }
  return result;
}
