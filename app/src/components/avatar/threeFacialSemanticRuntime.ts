import {
  buildFacialBindings,
  composeFacialWeights,
  type FacialSemantic,
  type FacialWeight,
} from "./facialSemanticMap";

export type ThreeFacialMorphTarget = Readonly<{
  object: {
    morphTargetInfluences?: number[] | null;
  };
  morphIndex: number;
  semantic: FacialSemantic;
}>;

/**
 * Bind semantic facial channels once when a GLB model is loaded. Each mesh is
 * resolved independently because morph indices are local to that mesh.
 */
export function bindThreeFacialMorphTargets(root: unknown): ThreeFacialMorphTarget[] {
  if (!root || typeof root !== "object") return [];
  const traverse = (root as { traverse?: unknown }).traverse;
  if (typeof traverse !== "function") return [];

  const result: ThreeFacialMorphTarget[] = [];
  (traverse as (visitor: (node: unknown) => void) => void).call(root, (candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    const node = candidate as {
      morphTargetDictionary?: Record<string, unknown> | null;
      morphTargetInfluences?: number[] | null;
    };
    const dictionary = node.morphTargetDictionary;
    const influences = node.morphTargetInfluences;
    if (!dictionary || !Array.isArray(influences)) return;

    const targets = Object.entries(dictionary).map(([name, index]) => ({
      name,
      index: typeof index === "number" ? index : Number.NaN,
    }));
    for (const binding of buildFacialBindings(targets)) {
      if (binding.target.index >= influences.length) continue;
      result.push({
        object: node,
        morphIndex: binding.target.index,
        semantic: binding.semantic,
      });
    }
  });
  return result;
}

/**
 * Apply only morph channels owned by the semantic map. Unrecognized/custom
 * channels are deliberately left untouched. Speech-frame visemes override
 * idle/expression mouth shapes via composeFacialWeights.
 */
export function applyThreeFacialSemanticWeights(
  bindings: readonly ThreeFacialMorphTarget[],
  expressionWeights: Readonly<Record<string, number>>,
  speechVisemes: readonly FacialWeight[] = [],
): void {
  if (!bindings.length) return;
  const expressions: FacialWeight[] = [];
  for (const [semantic, weight] of Object.entries(expressionWeights)) {
    if ([
      "neutral", "happy", "sad", "angry", "relaxed", "surprised",
      "blink", "blinkLeft", "blinkRight", "lookUp", "lookDown",
      "lookLeft", "lookRight", "aa", "ih", "ou", "ee", "oh",
    ].includes(semantic)) {
      expressions.push({ semantic: semantic as FacialSemantic, weight });
    }
  }
  const weights = composeFacialWeights(expressions, speechVisemes);
  for (const binding of bindings) {
    const influences = binding.object.morphTargetInfluences;
    if (!influences || binding.morphIndex < 0 || binding.morphIndex >= influences.length) continue;
    influences[binding.morphIndex] = weights.get(binding.semantic) ?? 0;
  }
}
