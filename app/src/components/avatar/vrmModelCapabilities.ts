/**
 * Runtime capability audit for an imported VRM avatar.
 *
 * This is deliberately a read-only adapter: it reports what the loaded model
 * can actually do instead of assuming every VRM has a complete humanoid rig.
 */
export const VRM_HUMANOID_BONE_NAMES = [
  "hips", "spine", "chest", "upperChest", "neck", "head",
  "leftEye", "rightEye", "jaw",
  "leftShoulder", "rightShoulder",
  "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
  "leftHand", "rightHand",
  "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg",
  "leftFoot", "rightFoot", "leftToes", "rightToes",
  "leftThumbMetacarpal", "leftThumbProximal", "leftThumbDistal",
  "leftIndexProximal", "leftIndexIntermediate", "leftIndexDistal",
  "leftMiddleProximal", "leftMiddleIntermediate", "leftMiddleDistal",
  "leftRingProximal", "leftRingIntermediate", "leftRingDistal",
  "leftLittleProximal", "leftLittleIntermediate", "leftLittleDistal",
  "rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal",
  "rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal",
  "rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal",
  "rightRingProximal", "rightRingIntermediate", "rightRingDistal",
  "rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal",
] as const;

export type VrmHumanoidBoneName = (typeof VRM_HUMANOID_BONE_NAMES)[number];

export interface VrmModelCapabilities {
  isVrm: boolean;
  humanoid: {
    available: number;
    total: number;
    missing: VrmHumanoidBoneName[];
    coreComplete: boolean;
    upperBody: boolean;
    lowerBody: boolean;
    hands: boolean;
    fingers: boolean;
  };
  face: {
    expressionManager: boolean;
    expressions: string[];
    blink: boolean;
    visemes: string[];
  };
  motion: {
    animationMixerSupported: boolean;
    embeddedClips: number;
    springBoneJoints: number;
    lookAt: boolean;
  };
  geometry: {
    meshes: number;
    skinnedMeshes: number;
    bones: number;
  };
  grade: "full" | "body" | "limited" | "static";
  warnings: string[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function safeLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Inspect a Pixiv three-vrm runtime object and its scene without mutating it. */
export function inspectVrmModelCapabilities(
  input: unknown,
  embeddedClipCount = 0,
): VrmModelCapabilities {
  const vrm = record(input);
  const humanoid = record(vrm?.humanoid);
  const expressionManager = record(vrm?.expressionManager);
  const springBoneManager = record(vrm?.springBoneManager);
  const scene = record(vrm?.scene);

  const getBone = humanoid?.getNormalizedBoneNode;
  const hasBone = (name: VrmHumanoidBoneName): boolean => {
    if (typeof getBone !== "function") return false;
    try {
      return Boolean((getBone as (bone: string) => unknown).call(humanoid, name));
    } catch {
      return false;
    }
  };

  const missing = VRM_HUMANOID_BONE_NAMES.filter((name) => !hasBone(name));
  const available = VRM_HUMANOID_BONE_NAMES.length - missing.length;
  const has = (names: readonly VrmHumanoidBoneName[]) => names.every(hasBone);
  const coreComplete = has(["hips", "spine", "neck", "head"]);
  const upperBody = has(["leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm"]);
  const lowerBody = has(["leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"]);
  const hands = has(["leftHand", "rightHand"]);
  const fingers = has(["leftIndexProximal", "leftMiddleProximal", "leftRingProximal", "leftLittleProximal", "rightIndexProximal", "rightMiddleProximal", "rightRingProximal", "rightLittleProximal"]);

  const expressionNames = new Set<string>();
  const rawExpressions = expressionManager?.expressions;
  if (Array.isArray(rawExpressions)) {
    for (const expression of rawExpressions) {
      const name = record(expression)?.expressionName;
      if (typeof name === "string" && name.trim()) expressionNames.add(name.trim());
    }
  }
  const getValue = expressionManager?.getValue;
  if (typeof getValue === "function") {
    for (const name of ["happy", "angry", "sad", "relaxed", "surprised", "aa", "ih", "ou", "ee", "oh", "blink", "blinkLeft", "blinkRight"]) {
      try {
        if ((getValue as (key: string) => unknown).call(expressionManager, name) !== null) expressionNames.add(name);
      } catch {
        // An expression manager may reject unknown presets; continue inspection.
      }
    }
  }
  const expressions = [...expressionNames].sort();
  const visemes = ["aa", "ih", "ou", "ee", "oh"].filter((name) => expressionNames.has(name));
  const joints = safeLength(springBoneManager?.joints);

  let meshes = 0;
  let skinnedMeshes = 0;
  let bones = 0;
  const traverse = scene?.traverse;
  if (typeof traverse === "function") {
    try {
      (traverse as (visitor: (node: unknown) => void) => void).call(scene, (rawNode) => {
        const node = record(rawNode);
        if (!node) return;
        if (node.isMesh || node.isSkinnedMesh) meshes += 1;
        if (node.isSkinnedMesh) skinnedMeshes += 1;
        if (node.isBone) bones += 1;
      });
    } catch {
      // A malformed third-party object must not crash the capability report.
    }
  }

  const lookAt = Boolean(vrm?.lookAt);
  const embeddedClips = Number.isFinite(embeddedClipCount) ? Math.max(0, Math.floor(embeddedClipCount)) : 0;
  const isVrm = Boolean(vrm && humanoid);
  const warnings: string[] = [];
  if (!isVrm) warnings.push("Файл загружен как glTF/GLB, но VRM humanoid runtime не обнаружен.");
  if (!coreComplete) warnings.push("Не хватает основных humanoid-костей: полноценная поза тела недоступна.");
  if (!upperBody) warnings.push("Неполный скелет рук: жесты и IK рук будут ограничены.");
  if (!lowerBody) warnings.push("Неполный скелет ног: ходьба, стойка и IK ног будут ограничены.");
  if (!hands) warnings.push("Нет обеих кистей: точные жесты и контакт с предметами ограничены.");
  if (!fingers) warnings.push("Не обнаружен полный набор основных костей пальцев.");
  if (!expressions.length) warnings.push("Нет распознанных VRM expressions: мимику придётся ограничить morph-target fallback.");
  if (!visemes.length) warnings.push("Нет VRM visemes: точная артикуляция речи не подтверждена.");
  if (!lookAt) warnings.push("VRM LookAt отсутствует; взгляд должен использовать fallback.");
  if (!joints) warnings.push("SpringBone joints не обнаружены; физика волос и одежды не подтверждена.");
  if (!skinnedMeshes) warnings.push("Не обнаружены SkinnedMesh: геометрия может быть статичной или процедурной.");

  const grade = !isVrm || !coreComplete || !skinnedMeshes
    ? "static"
    : coreComplete && upperBody && lowerBody && hands && fingers && visemes.length >= 3 && lookAt
      ? "full"
      : coreComplete && upperBody && lowerBody
        ? "body"
        : "limited";

  return {
    isVrm,
    humanoid: { available, total: VRM_HUMANOID_BONE_NAMES.length, missing, coreComplete, upperBody, lowerBody, hands, fingers },
    face: { expressionManager: Boolean(expressionManager), expressions, blink: expressions.some((name) => name.toLowerCase().includes("blink")), visemes },
    motion: { animationMixerSupported: isVrm, embeddedClips, springBoneJoints: joints, lookAt },
    geometry: { meshes, skinnedMeshes, bones },
    grade,
    warnings,
  };
}

/** Compact Russian summary suitable for a model-import status panel. */
export function summarizeVrmModelCapabilities(capabilities: VrmModelCapabilities): string {
  const grade = capabilities.grade === "full" ? "полный humanoid"
    : capabilities.grade === "body" ? "базовое тело"
      : capabilities.grade === "limited" ? "ограниченный риг" : "статическая/неполная модель";
  return [
    grade,
    `кости ${capabilities.humanoid.available}/${capabilities.humanoid.total}`,
    `SkinnedMesh ${capabilities.geometry.skinnedMeshes}`,
    `выражения ${capabilities.face.expressions.length}`,
    `viseme ${capabilities.face.visemes.length}/5`,
    `SpringBone ${capabilities.motion.springBoneJoints}`,
    `LookAt ${capabilities.motion.lookAt ? "есть" : "нет"}`,
  ].join(" · ");
}
