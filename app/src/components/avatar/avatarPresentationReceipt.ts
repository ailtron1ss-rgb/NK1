export type AvatarPresentationMode = "live2d" | "original" | "3d" | "legacy";
export type AvatarPresentationRenderer = "live2d" | "original2d" | "webgl3d";
export type AvatarPresentationStage =
  | "parameters-observed"
  | "accepted-unverified"
  | "dom-committed"
  | "webgl-render-submitted";

export interface AvatarPresentationReceiptV1 {
  schemaVersion: 1;
  renderer: AvatarPresentationRenderer;
  /** Canonical organism snapshot tick; intentionally not the Live2D intent sequence. */
  tick: number;
  stateVersion: number;
  stage: AvatarPresentationStage;
  /** No current renderer ACK proves that pixels were actually presented to the user. */
  visualCompletionVerified: false;
}

const RENDERER_FOR_MODE: Record<AvatarPresentationMode, AvatarPresentationRenderer | null> = {
  live2d: "live2d",
  original: "original2d",
  "3d": "webgl3d",
  legacy: null,
};

const VALID_STAGES: Record<AvatarPresentationRenderer, ReadonlySet<AvatarPresentationStage>> = {
  live2d: new Set(["parameters-observed", "accepted-unverified"]),
  original2d: new Set(["dom-committed"]),
  webgl3d: new Set(["webgl-render-submitted"]),
};

export function createAvatarPresentationReceipt(
  renderer: AvatarPresentationRenderer,
  tick: number,
  stage: AvatarPresentationStage,
): AvatarPresentationReceiptV1 | null {
  if (!Object.hasOwn(VALID_STAGES, renderer) || !VALID_STAGES[renderer].has(stage)) return null;
  if (!Number.isSafeInteger(tick) || tick < 0) return null;
  return {
    schemaVersion: 1,
    renderer,
    tick,
    stateVersion: tick,
    stage,
    visualCompletionVerified: false,
  };
}

export function isCurrentAvatarPresentationReceipt(
  receipt: AvatarPresentationReceiptV1 | null | undefined,
  mode: AvatarPresentationMode,
  tick: number,
): receipt is AvatarPresentationReceiptV1 {
  const renderer = RENDERER_FOR_MODE[mode];
  if (!renderer || !receipt || typeof receipt !== "object") return false;
  return receipt.schemaVersion === 1
    && receipt.renderer === renderer
    && Number.isSafeInteger(tick) && tick >= 0
    && receipt.tick === tick
    && receipt.stateVersion === tick
    && receipt.visualCompletionVerified === false
    && VALID_STAGES[renderer].has(receipt.stage);
}

export function describeAvatarFrameStatus(
  mode: AvatarPresentationMode,
  tick: number,
  receipt: AvatarPresentationReceiptV1 | null | undefined,
): string {
  if (mode === "legacy") return "Legacy: статичный fallback без динамического подтверждения кадра";
  if (!Number.isSafeInteger(tick) || tick < 0) return "Канонический tick недоступен";
  if (!isCurrentAvatarPresentationReceipt(receipt, mode, tick)) {
    return `Кадр #${tick}: ожидается подтверждение текущего renderer`;
  }
  switch (receipt.stage) {
    case "parameters-observed":
      return `Live2D · кадр #${tick}: параметры прочитаны; показ кадра не подтверждён`;
    case "accepted-unverified":
      return `Live2D · кадр #${tick}: intent принят без readback; показ кадра не подтверждён`;
    case "dom-committed":
      return `Original 2D · кадр #${tick}: SVG DOM сформирован; показ кадра не подтверждён`;
    case "webgl-render-submitted":
      return `3D · кадр #${tick}: WebGL draw call отправлен; показ кадра не подтверждён`;
  }
}
