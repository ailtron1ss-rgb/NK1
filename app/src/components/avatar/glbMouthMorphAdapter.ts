import type { MouthPose } from "./embodimentTimeline";

export interface GlbMouthMorphWeight {
  index: number;
  value: number;
}

const MOUTH_TARGET_NAMES = new Set([
  "mouthopen", "jawopen",
  "visemeaa", "phonemeaa",
  "visemeih", "phonemeih",
  "visemeee", "phonemeee",
  "visemeoh", "phonemeoh",
  "visemeou", "phonemeou",
]);

const normalizeTargetName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

const clampUnit = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/**
 * Resolve one active generic-GLB mouth morph from NK1's bounded viseme pose.
 *
 * The source timeline intentionally uses broad articulatory classes rather than
 * claiming phoneme-level acoustic ground truth. The model may expose more specific
 * targets; form selects the closest available target while preserving a neutral
 * reset for every inactive mouth channel.
 */
export function resolveGlbMouthMorphWeights(
  dictionary: unknown,
  pose: MouthPose | null | undefined,
  speaking: boolean,
): GlbMouthMorphWeight[] {
  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary) || !pose) return [];

  const entries = Object.entries(dictionary as Record<string, unknown>)
    .filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isSafeInteger(entry[1]) && entry[1] >= 0,
    );
  const mouthEntries = entries.filter(([name]) => MOUTH_TARGET_NAMES.has(normalizeTargetName(name)));
  const result = mouthEntries.map(([, index]) => ({ index, value: 0 }));

  if (!speaking) return result;

  const open = clampUnit(pose.open);
  if (open <= 0) return result;

  const form = Number.isFinite(pose.form) ? pose.form : 0;
  let candidates: string[];
  switch (pose.viseme) {
    case "open":
      candidates = ["visemeaa", "phonemeaa", "mouthopen", "jawopen"];
      break;
    case "round":
      candidates = form <= -0.4
        ? ["visemeou", "phonemeou", "visemeoh", "phonemeoh", "mouthopen", "jawopen"]
        : ["visemeoh", "phonemeoh", "visemeou", "phonemeou", "mouthopen", "jawopen"];
      break;
    case "wide":
      candidates = form >= 0.28
        ? ["visemeee", "phonemeee", "visemeih", "phonemeih", "mouthopen", "jawopen"]
        : ["visemeih", "phonemeih", "visemeee", "phonemeee", "mouthopen", "jawopen"];
      break;
    case "teeth":
      candidates = ["visemeih", "phonemeih", "visemeee", "phonemeee", "mouthopen", "jawopen"];
      break;
    case "neutral":
      candidates = open >= 0.12
        ? ["mouthopen", "jawopen", "visemeaa", "phonemeaa"]
        : [];
      break;
    case "closed":
    case "rest":
    default:
      candidates = [];
      break;
  }

  const targetByName = new Map<string, number>();
  for (const [name, index] of entries) {
    const normalized = normalizeTargetName(name);
    if (!targetByName.has(normalized)) targetByName.set(normalized, index);
  }
  const selected = candidates.map((name) => targetByName.get(name)).find((index) => index !== undefined);
  if (selected !== undefined) {
    const target = result.find((item) => item.index === selected);
    if (target) target.value = open;
  }

  return result;
}
