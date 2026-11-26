import { DEFAULT_RENDERER_MANIFESTS } from "./rendererRegistryDefaults.ts";
import type { AvatarRigClass } from "./rendererCapabilityManifest.ts";

export type AvatarViewMode = "live2d" | "legacy" | "original" | "3d";

const RENDERER_BY_VIEW_MODE: Record<AvatarViewMode, string> = {
  live2d: "nk1-live2d-cubism",
  legacy: "nk1-legacy-sprites-2d",
  original: "nk1-original-svg-2d",
  "3d": "nk1-three-vrm3d",
};

const VIEW_LABELS: Record<AvatarViewMode, string> = {
  live2d: "Live2D",
  legacy: "Legacy",
  original: "NK1 Original",
  "3d": "3D",
};

const RIG_COPY: Record<AvatarRigClass, { label: string; description: string }> = {
  none: { label: "без рига", description: "Тело без подключённого рига" },
  "static-poses": {
    label: "статичные PNG-позы без рига",
    description: "Статичные спрайты · готовые PNG-позы без деформируемого рига",
  },
  "vector-driven": {
    label: "SVG-вектор с ограниченной 2D-анимацией",
    description: "SVG-вектор · ограниченная 2D-анимация, не полноценный скелетный риг",
  },
  "cubism-deform": {
    label: "деформируемый Cubism-риг",
    description: "Cubism · деформируемое 2D-тело",
  },
  "layered-depth-puppet": {
    label: "слоёный 2.5D depth-rig",
    description: "2.5D · слоёная глубинная модель; доступность зависит от готового набора арта",
  },
  "humanoid-skeleton": {
    label: "гуманоидный скелет VRM / GLB",
    description: "VRM / GLB · гуманоидная 3D-модель",
  },
};

export interface AvatarRendererPresentation {
  viewMode: AvatarViewMode;
  rendererId: string;
  label: string;
  rigClass: AvatarRigClass;
  selectionRole: "primary" | "fallback" | "preview-only" | null;
  selectable: boolean;
  previewOnly: boolean;
  ariaLabel: string;
  title: string;
  description: string;
}

/** UI copy comes from the capability registry, not a second guessed renderer list. */
export function avatarRendererPresentation(mode: AvatarViewMode): AvatarRendererPresentation {
  const rendererId = RENDERER_BY_VIEW_MODE[mode];
  const manifest = DEFAULT_RENDERER_MANIFESTS.find((entry) => entry.rendererId === rendererId);
  const label = VIEW_LABELS[mode];

  if (!manifest || !manifest.rigClass) {
    const unknown = "тип рига не подтверждён реестром возможностей";
    return {
      viewMode: mode, rendererId, label, rigClass: "none", selectionRole: null,
      selectable: false, previewOnly: true,
      ariaLabel: "Выбрать " + label + " — " + unknown,
      title: label + " · " + unknown,
      description: "Описание тела недоступно: реестр возможностей не подтвердил его тип",
    };
  }

  const copy = RIG_COPY[manifest.rigClass];
  const previewOnly = manifest.selectionRole === "preview-only" || !manifest.productionReady;
  const approvalNote = previewOnly ? " · предпросмотр, не прошедший приёмку для выпуска" : "";
  return {
    viewMode: mode, rendererId, label, rigClass: manifest.rigClass,
    selectionRole: manifest.selectionRole ?? null,
    selectable: manifest.productionReady && manifest.assetKind !== "none" && !previewOnly,
    previewOnly,
    ariaLabel: "Выбрать " + label + " — " + copy.label + approvalNote,
    title: label + " · " + copy.label + approvalNote,
    description: previewOnly
      ? copy.description + " · кандидат для предпросмотра, не прошедший приёмку для выпуска"
      : copy.description,
  };
}
