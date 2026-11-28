export interface GlbMorphNeutralizationReport {
  meshCount: number;
  managedTargetCount: number;
  resetTargetCount: number;
  resetTargetNames: string[];
}

interface MorphNode {
  isMesh?: boolean;
  morphTargetDictionary?: Record<string, unknown>;
  morphTargetInfluences?: number[] | null;
}

interface MorphRoot {
  traverse(visitor: (node: MorphNode) => void): void;
}

const normalizeTargetName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Generic GLB files may serialize every face-expression weight as active.
 * NK1 owns these known facial channels, so establish a neutral starting pose
 * before any geometry bounds, diagnostics, or first render are calculated.
 *
 * Unknown corrective targets and explicitly separate secondary-physics
 * channels are preserved. VRM expression state remains owned by its adapter.
 */
const NK1_CONTROLLED_FACIAL_TARGETS = new Set([
  "happy", "joy", "smile", "grin",
  "sad", "sorrow", "cry", "worried",
  "angry", "anger", "frown", "surprised", "curious",
  "smirkleft", "smirkright", "pout",
  "browraise", "browfurrow", "browconcern", "browsurprise",
  "browskeptic", "browfocus", "eyesquint", "eyewide",
  "blink", "winkleft", "winkright",
  "jawopen", "mouthopen", "gazeleft", "gazeright", "gazeup", "gazedown",
  "eyeclose", "eyeclosed",
  "visemeaa", "phonemeaa", "visemeih", "phonemeih",
  "visemeee", "phonemeee", "visemeoh", "phonemeoh",
  "visemeou", "phonemeou",
]);

export function resetNk1ControlledGlbFacialMorphs(root: MorphRoot): GlbMorphNeutralizationReport {
  const report: GlbMorphNeutralizationReport = {
    meshCount: 0,
    managedTargetCount: 0,
    resetTargetCount: 0,
    resetTargetNames: [],
  };
  const reportedNames = new Set<string>();

  root.traverse((node) => {
    const dictionary = node.morphTargetDictionary;
    const influences = node.morphTargetInfluences;
    if (node.isMesh !== true || !dictionary || !influences) return;

    report.meshCount += 1;
    const visitedIndices = new Set<number>();
    for (const [name, rawIndex] of Object.entries(dictionary)) {
      const normalizedName = normalizeTargetName(name);
      if (!NK1_CONTROLLED_FACIAL_TARGETS.has(normalizedName)) continue;
      if (typeof rawIndex !== "number" || !Number.isSafeInteger(rawIndex)
        || rawIndex < 0 || rawIndex >= influences.length || visitedIndices.has(rawIndex)) continue;

      visitedIndices.add(rawIndex);
      report.managedTargetCount += 1;
      if (!reportedNames.has(name)) {
        reportedNames.add(name);
        report.resetTargetNames.push(name);
      }
      const current = influences[rawIndex];
      if (Number.isFinite(current) && Math.abs(current) > 1e-6) {
        influences[rawIndex] = 0;
        report.resetTargetCount += 1;
      }
    }
  });

  return report;
}
