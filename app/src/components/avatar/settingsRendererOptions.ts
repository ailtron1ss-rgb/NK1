import type { AvatarViewMode } from "@/organism/store";
import type { AvatarAssetKind, BodyRendererCapabilityManifest } from "./rendererCapabilityManifest";
import { DEFAULT_RENDERER_MANIFESTS } from "./rendererRegistryDefaults.ts";

/**
 * UI identifiers are deliberately distinct from the coarse embodiment mode:
 * Original SVG and Legacy sprites currently share the "live2d" capability class,
 * but remain separate user-selectable renderer identities.
 */
export const SETTINGS_RENDERER_ID_BY_VIEW_MODE: Readonly<Record<AvatarViewMode, string>> = {
  live2d: "nk1-live2d-cubism",
  original: "nk1-original-svg-2d",
  legacy: "nk1-legacy-sprites-2d",
  "3d": "nk1-three-vrm3d",
};

const ASSET_KIND_LABELS: Record<AvatarAssetKind, string> = {
  none: "без отдельного ассета",
  "sprite-sheet": "статичные PNG-позы",
  "svg-vector": "векторная SVG-сцена",
  "cubism-model": "деформируемый риг Cubism",
  "layered-depth-rig": "многослойный 2.5D-риг",
  gltf: "модель GLB / glTF",
  vrm: "гуманоидная модель VRM",
};

export interface SettingsRendererOption {
  id: AvatarViewMode;
  rendererId: string;
  label: string;
  description: string;
  availability: string;
  productionReady: boolean;
}

export function buildSettingsRendererOptions(
  manifests: readonly BodyRendererCapabilityManifest[] = DEFAULT_RENDERER_MANIFESTS,
): SettingsRendererOption[] {
  const byId = new Map<string, BodyRendererCapabilityManifest>();
  for (const manifest of manifests) {
    if (byId.has(manifest.rendererId)) {
      throw new Error(`duplicate renderer id: ${manifest.rendererId}`);
    }
    byId.set(manifest.rendererId, manifest);
  }

  return (Object.entries(SETTINGS_RENDERER_ID_BY_VIEW_MODE) as Array<[AvatarViewMode, string]>)
    .map(([id, rendererId]) => {
      const renderer = byId.get(rendererId);
      if (!renderer) {
        throw new Error(`missing renderer manifest: ${rendererId}`);
      }

      const productionReady = renderer.productionReady;
      return {
        id,
        rendererId,
        label: productionReady ? renderer.label : `${renderer.label} · предпросмотр`,
        description: [
          ASSET_KIND_LABELS[renderer.assetKind],
          `${renderer.channels.length} управляемых каналов`,
          `${renderer.expressions.length} выражений`,
          `речь и viseme: ${renderer.supportsSpeechVisemes ? "поддерживаются" : "не поддерживаются"}`,
          `физика: ${renderer.supportsPhysics ? "есть" : "нет"}`,
        ].join(" · "),
        availability: productionReady
          ? "Реальный ассет доступен для выбора."
          : "Предпросмотр · требуется визуальная, мобильная и лицензионная приёмка.",
        productionReady,
      };
    });
}

export const SETTINGS_RENDERER_OPTIONS: readonly SettingsRendererOption[] =
  buildSettingsRendererOptions();
