export type VrmMorphTargetKind = "node" | "mesh";
export type VrmExpressionOverride = "none" | "block" | "blend";

export interface VrmMorphTargetBind {
  targetKind: VrmMorphTargetKind;
  targetIndex: number;
  morphIndex: number;
  weight: number;
}

export interface VrmExpressionDefinition {
  key: string;
  isBinary: boolean;
  overrideMouth: VrmExpressionOverride;
  overrideBlink: VrmExpressionOverride;
  overrideLookAt: VrmExpressionOverride;
  binds: VrmMorphTargetBind[];
}

export interface VrmExpressionInput {
  emotion: string;
  valence?: number;
  arousal?: number;
  curiosity?: number;
  warmth?: number;
  speaking?: boolean;
  awake?: boolean;
  mouthPose?: {
    open: number;
    form: number;
    viseme: string;
  };
  gazeX?: number;
  gazeY?: number;
  blink?: number;
}

export interface VrmMorphTargetObject {
  morphTargetInfluences?: number[] | null;
  traverse?: (visitor: (object: VrmMorphTargetObject) => void) => void;
}

export interface VrmObjectAssociation {
  nodes?: number;
  meshes?: number;
}

export interface VrmMorphTargetGroup {
  object: VrmMorphTargetObject;
  morphIndex: number;
  bindings: Array<{ expression: string; weight: number }>;
}

const KNOWN_EXPRESSIONS = new Set([
  "happy", "angry", "sad", "relaxed", "surprised",
  "aa", "ih", "ou", "ee", "oh",
  "blink", "blinkLeft", "blinkRight",
  "lookUp", "lookDown", "lookLeft", "lookRight",
]);

const EXPRESSION_ALIASES: Record<string, string> = {
  joy: "happy",
  happy: "happy",
  angry: "angry",
  anger: "angry",
  frustration: "angry",
  sad: "sad",
  sorrow: "sad",
  sadness: "sad",
  anxiety: "sad",
  relaxed: "relaxed",
  fun: "relaxed",
  calm: "relaxed",
  surprised: "surprised",
  a: "aa",
  aa: "aa",
  i: "ih",
  ih: "ih",
  u: "ou",
  ou: "ou",
  e: "ee",
  ee: "ee",
  o: "oh",
  oh: "oh",
  blink: "blink",
  blinkleft: "blinkLeft",
  blinkl: "blinkLeft",
  blinkright: "blinkRight",
  blinkr: "blinkRight",
  lookup: "lookUp",
  lookdown: "lookDown",
  lookleft: "lookLeft",
  lookright: "lookRight",
};

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function entries(value: unknown): Array<[string, unknown]> {
  return isRecord(value) ? Object.entries(value) : [];
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function canonicalizeVrmExpressionKey(value: unknown): string | null {
  const normalized = String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]/gu, "");
  const canonical = EXPRESSION_ALIASES[normalized];
  return canonical && KNOWN_EXPRESSIONS.has(canonical) ? canonical : null;
}

function overrideValue(value: unknown): VrmExpressionOverride {
  return value === "block" || value === "blend" ? value : "none";
}

function parseBinds(
  value: unknown,
  targetKind: VrmMorphTargetKind,
  weightScale: number,
): VrmMorphTargetBind[] {
  const result: VrmMorphTargetBind[] = [];
  for (const raw of safeArray(value)) {
    if (!isRecord(raw)) continue;
    const targetIndex = raw[targetKind];
    const morphIndex = raw.index;
    const rawWeight = raw.weight;
    if (!Number.isSafeInteger(targetIndex) || (targetIndex as number) < 0 ||
        !Number.isSafeInteger(morphIndex) || (morphIndex as number) < 0 ||
        typeof rawWeight !== "number" || !Number.isFinite(rawWeight)) continue;

    result.push({
      targetKind,
      targetIndex: targetIndex as number,
      morphIndex: morphIndex as number,
      weight: clamp(rawWeight / weightScale),
    });
  }
  return result;
}

function parseExpression(
  key: string,
  raw: unknown,
  targetKind: VrmMorphTargetKind,
  weightScale: number,
): VrmExpressionDefinition | null {
  if (!isRecord(raw)) return null;
  const binds = parseBinds(raw.morphTargetBinds ?? raw.binds, targetKind, weightScale);
  if (!binds.length) return null;
  return {
    key,
    isBinary: raw.isBinary === true,
    overrideMouth: overrideValue(raw.overrideMouth),
    overrideBlink: overrideValue(raw.overrideBlink),
    overrideLookAt: overrideValue(raw.overrideLookAt),
    binds,
  };
}

/**
 * Reads the native facial-expression maps from VRM 1.0 and legacy VRM 0.x.
 * VRM 1.0 morph weights are normalized [0, 1]; VRM 0.x BlendShape weights
 * are authored in [0, 100]. Only known preset/alias keys are wired to the
 * organism's state; custom facial controls remain untouched by NK1.
 */
export function buildVrmExpressionMap(extensionRoot: unknown): VrmExpressionDefinition[] {
  if (!isRecord(extensionRoot)) return [];
  const result = new Map<string, VrmExpressionDefinition>();

  const modern = extensionRoot.VRMC_vrm;
  if (isRecord(modern) && isRecord(modern.expressions)) {
    const expressions = modern.expressions;
    for (const section of [expressions.preset, expressions.custom]) {
      for (const [name, raw] of entries(section)) {
        const key = canonicalizeVrmExpressionKey(name);
        if (!key || result.has(key)) continue;
        const parsed = parseExpression(key, raw, "node", 1);
        if (parsed) result.set(key, parsed);
      }
    }
  }

  const legacy = extensionRoot.VRM;
  if (isRecord(legacy) && isRecord(legacy.blendShapeMaster)) {
    const groups = safeArray(legacy.blendShapeMaster.blendShapeGroups);
    for (const raw of groups) {
      if (!isRecord(raw)) continue;
      const presetName = typeof raw.presetName === "string" ? raw.presetName : "";
      const preferred = presetName && presetName.toLowerCase() !== "unknown" ? presetName : raw.name;
      const key = canonicalizeVrmExpressionKey(preferred);
      if (!key || result.has(key)) continue;
      const parsed = parseExpression(key, raw, "mesh", 100);
      if (parsed) result.set(key, parsed);
    }
  }

  return Array.from(result.values());
}

function binaryWeight(definition: VrmExpressionDefinition | undefined, weight: number): number {
  if (!definition?.isBinary) return weight;
  return weight > 0.5 ? 1 : 0;
}

function proceduralWeight(
  definitions: ReadonlyMap<string, VrmExpressionDefinition>,
  key: string,
  weight: number,
): number {
  return binaryWeight(definitions.get(key), clamp(weight));
}

/**
 * Convert canonical organism affect + the existing grapheme viseme into VRM
 * expression weights. No extra emotion engine is created: this is a rendering
 * adapter over the current snapshot, and leaves the source snapshot untouched.
 */
export function deriveVrmExpressionWeights(
  definitions: readonly VrmExpressionDefinition[],
  input: VrmExpressionInput,
): Record<string, number> {
  const definitionMap = new Map<string, VrmExpressionDefinition>(definitions.map((definition) => [definition.key, definition] as const));
  const emotion = String(input.emotion ?? "calm").toLowerCase();
  const valence = clamp(input.valence ?? 0.5);
  const arousal = clamp(input.arousal ?? 0.5);
  const curiosity = clamp(input.curiosity ?? 0.5);
  const warmth = clamp(input.warmth ?? 0.5);
  const values: Record<string, number> = Object.fromEntries(
    Array.from(KNOWN_EXPRESSIONS, (key) => [key, 0]),
  );

  if (emotion === "joy") values.happy = 0.60 + valence * 0.12 + arousal * 0.08;
  else if (emotion === "anger") values.angry = 0.58 + arousal * 0.17;
  else if (emotion === "frustration") values.angry = 0.42 + arousal * 0.12;
  else if (emotion === "sadness") values.sad = 0.56 + (1 - valence) * 0.12;
  else if (emotion === "anxiety") values.sad = 0.26 + arousal * 0.12;
  else if (emotion === "calm") values.relaxed = 0.12 + warmth * 0.16;
  else if (emotion === "protective") values.relaxed = 0.12;
  else if (emotion === "curiosity") values.surprised = 0.08 + curiosity * 0.16;

  const pose = input.speaking ? input.mouthPose : undefined;
  if (pose) {
    const open = clamp(pose.open);
    switch (pose.viseme) {
      case "open":
        values.aa = open;
        break;
      case "wide":
        values.ih = open * 0.72;
        values.ee = open * 0.42;
        break;
      case "round":
        values.ou = open * 0.68;
        values.oh = open * 0.42;
        break;
      case "teeth":
        values.ee = open * 0.58;
        values.ih = open * 0.24;
        break;
      case "neutral":
        values.aa = open * 0.18;
        break;
      case "closed":
      case "rest":
      default:
        break;
    }
  }

  values.blink = input.awake === false ? 0 : clamp(input.blink ?? 0);
  values.lookLeft = clamp(-(input.gazeX ?? 0));
  values.lookRight = clamp(input.gazeX ?? 0);
  values.lookUp = clamp(-(input.gazeY ?? 0));
  values.lookDown = clamp(input.gazeY ?? 0);

  for (const key of Object.keys(values)) {
    values[key] = binaryWeight(definitionMap.get(key), values[key]);
  }

  // VRM's overrideMouth/overrideBlink/overrideLookAt applies only to
  // procedural expressions. "block" suppresses them while active; "blend"
  // attenuates them linearly by the sum of overriding facial-expression weights.
  const facialKeys = ["happy", "angry", "sad", "relaxed", "surprised"];
  const factors = { mouth: 1, blink: 1, lookAt: 1 };
  const blocked = { mouth: false, blink: false, lookAt: false };
  const blend = { mouth: 0, blink: 0, lookAt: 0 };

  for (const key of facialKeys) {
    const weight = values[key] ?? 0;
    if (weight <= 0) continue;
    const definition = definitionMap.get(key);
    if (!definition) continue;
    for (const [channel, rule] of [
      ["mouth", definition.overrideMouth],
      ["blink", definition.overrideBlink],
      ["lookAt", definition.overrideLookAt],
    ] as const) {
      if (rule === "block") blocked[channel] = true;
      else if (rule === "blend") blend[channel] += weight;
    }
  }

  for (const channel of ["mouth", "blink", "lookAt"] as const) {
    factors[channel] = blocked[channel] ? 0 : 1 - clamp(blend[channel]);
  }

  const proceduralGroups = {
    mouth: ["aa", "ih", "ou", "ee", "oh"],
    blink: ["blink", "blinkLeft", "blinkRight"],
    lookAt: ["lookUp", "lookDown", "lookLeft", "lookRight"],
  };
  for (const [channel, keys] of Object.entries(proceduralGroups) as Array<[keyof typeof factors, string[]]>) {
    for (const key of keys) {
      values[key] = proceduralWeight(definitionMap, key, values[key] * factors[channel]);
    }
  }

  return values;
}

function isMorphObject(value: unknown): value is VrmMorphTargetObject {
  return isRecord(value) && Array.isArray(value.morphTargetInfluences);
}

function collectMorphObjects(root: unknown): VrmMorphTargetObject[] {
  if (!isRecord(root)) return [];
  const result: VrmMorphTargetObject[] = [];
  const visited = new Set<object>();
  const visit = (candidate: unknown) => {
    if (!isRecord(candidate) || visited.has(candidate)) return;
    visited.add(candidate);
    if (isMorphObject(candidate)) result.push(candidate);
  };

  if (isMorphObject(root)) visit(root);
  else if (typeof root.traverse === "function") {
    (root.traverse as (visitor: (object: unknown) => void) => void).call(root, visit);
  }
  return result;
}

/**
 * Resolves native VRM node/mesh indices to Three.js morph-target objects using
 * GLTFLoader.parser.associations. A node may be a multi-primitive Group; a
 * legacy mesh may also expand to multiple primitive Mesh objects. Both cases
 * are expanded and de-duplicated before the hot render loop.
 */
export function bindVrmExpressionTargets(
  definitions: readonly VrmExpressionDefinition[],
  associationEntries: Iterable<readonly [unknown, unknown]>,
): VrmMorphTargetGroup[] {
  const entriesList = Array.from(associationEntries);
  const objectGroups = new WeakMap<object, Map<number, VrmMorphTargetGroup>>();
  const result: VrmMorphTargetGroup[] = [];

  const addBinding = (
    object: VrmMorphTargetObject,
    morphIndex: number,
    expression: string,
    weight: number,
  ) => {
    const influences = object.morphTargetInfluences;
    if (!influences || !Number.isSafeInteger(morphIndex) || morphIndex < 0 || morphIndex >= influences.length) return;
    let byIndex = objectGroups.get(object as object);
    if (!byIndex) {
      byIndex = new Map<number, VrmMorphTargetGroup>();
      objectGroups.set(object as object, byIndex);
    }
    let group = byIndex.get(morphIndex);
    if (!group) {
      group = { object, morphIndex, bindings: [] };
      byIndex.set(morphIndex, group);
      result.push(group);
    }
    group.bindings.push({ expression, weight });
  };

  for (const definition of definitions) {
    for (const binding of definition.binds) {
      const matches = new Set<VrmMorphTargetObject>();
      for (const [rawObject, rawAssociation] of entriesList) {
        if (!isRecord(rawAssociation)) continue;
        const index = binding.targetKind === "node" ? rawAssociation.nodes : rawAssociation.meshes;
        if (index !== binding.targetIndex) continue;
        for (const morphObject of collectMorphObjects(rawObject)) matches.add(morphObject);
      }
      for (const object of matches) {
        addBinding(object, binding.morphIndex, definition.key, binding.weight);
      }
    }
  }

  return result;
}

/** Reset and accumulate only the morph targets owned by this VRM expression map. */
export function applyVrmMorphTargetWeights(
  groups: readonly VrmMorphTargetGroup[],
  expressionWeights: Readonly<Record<string, number>>,
): void {
  for (const group of groups) {
    const influences = group.object.morphTargetInfluences;
    if (!influences || group.morphIndex >= influences.length) continue;
    let weight = 0;
    for (const binding of group.bindings) {
      weight += clamp(expressionWeights[binding.expression] ?? 0) * binding.weight;
    }
    influences[group.morphIndex] = clamp(weight);
  }
}
