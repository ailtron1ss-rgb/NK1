export type Live2DExpressionReference = { Name?: string; File?: string };
export type Live2DModel3Manifest = {
  Version?: number;
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
    Physics?: string;
    DisplayInfo?: string;
    Expressions?: Live2DExpressionReference[];
    Motions?: Record<string, unknown[]>;
  };
  Groups?: Array<{ Name?: string; Ids?: string[] }>;
};
export type Live2DDisplayInfo = { Parameters?: Array<{ Id?: string; Name?: string }> };
export type Live2DExpressionFile = { Parameters?: Array<{ Id?: string; Value?: number; Blend?: string }> };

export type Live2DWardrobeCapability = {
  status: "switchable" | "limited-controls" | "no-switch-contract" | "invalid-manifest";
  canSwitchGarments: boolean;
  textureCount: number;
  motionGroupCount: number;
  expressionCount: number;
  parameterIds: string[];
  wardrobeControlIds: string[];
  expressionControlIds: string[];
  limitations: string[];
};

const WARDROBE_CONTROL = /(?:wardrobe|outfit|costume|garment|clothing|cloth|accessory|part)/i;

/**
 * Conservatively inspects public Cubism JSON metadata. A texture atlas, clothing-related
 * physics parameter, or expression name is not proof of a drawable/part switch API.
 * Only explicit wardrobe-named parameter IDs establish a switch contract.
 */
export function inspectLive2DWardrobeCapability(
  model: Live2DModel3Manifest,
  displayInfo: Live2DDisplayInfo,
  expressionFiles: Readonly<Record<string, Live2DExpressionFile>> = {},
): Live2DWardrobeCapability {
  const files = model?.FileReferences;
  const textures = Array.isArray(files?.Textures) ? files.Textures.length : 0;
  const motions = files?.Motions && typeof files.Motions === "object" ? Object.keys(files.Motions).length : 0;
  const expressions = Array.isArray(files?.Expressions) ? files.Expressions : [];
  const parameterIds = Array.isArray(displayInfo?.Parameters)
    ? displayInfo.Parameters.map((entry) => entry?.Id).filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const wardrobeControlIds = parameterIds.filter((id) => WARDROBE_CONTROL.test(id));
  const expressionControlIds = expressions.flatMap((entry) => {
    const path = entry?.File;
    if (typeof path !== "string") return [];
    const expression = expressionFiles[path];
    return Array.isArray(expression?.Parameters)
      ? expression.Parameters.map((parameter) => parameter?.Id).filter((id): id is string => typeof id === "string" && WARDROBE_CONTROL.test(id))
      : [];
  });
  const uniqueExpressionControls = [...new Set(expressionControlIds)];
  const valid = model?.Version === 3 && typeof files?.Moc === "string" && textures > 0;
  const limitations: string[] = [];
  if (!valid) limitations.push("model3-manifest-incomplete");
  if (textures > 0) limitations.push("texture-atlas-is-not-an-interchangeable-garment");
  if (wardrobeControlIds.length === 0 && uniqueExpressionControls.length === 0) {
    limitations.push("no-explicit-wardrobe-switch-parameter");
  }
  limitations.push("Cubism drawable/part IDs are not exposed by model3 JSON; inspect the moc3 model before authoring a part-switch adapter");
  limitations.push("existing expressions and physics are not proof of independent clothing layers");
  const canSwitchGarments = valid && wardrobeControlIds.length > 0;
  return {
    status: !valid ? "invalid-manifest" : canSwitchGarments ? "switchable" : uniqueExpressionControls.length ? "limited-controls" : "no-switch-contract",
    canSwitchGarments,
    textureCount: textures,
    motionGroupCount: motions,
    expressionCount: expressions.length,
    parameterIds,
    wardrobeControlIds,
    expressionControlIds: uniqueExpressionControls,
    limitations,
  };
}
