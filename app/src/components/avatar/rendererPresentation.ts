import type { AvatarAssetKind } from "./rendererCapabilityManifest";

/**
 * One Russian presentation name per canonical asset kind.
 * Avatar and Settings both consume this exhaustive dictionary.
 */
export const AVATAR_ASSET_KIND_LABELS: Record<AvatarAssetKind, string> = {
  none: "Без отдельного ассета",
  "sprite-sheet": "Статичные PNG-позы",
  "svg-vector": "Векторная SVG-сцена",
  "cubism-model": "Деформируемый риг Cubism",
  "layered-depth-rig": "Многослойный 2.5D-риг",
  gltf: "Модель GLB / glTF",
  vrm: "Гуманоидная модель VRM",
};
