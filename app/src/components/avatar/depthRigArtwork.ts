import type { DepthRigManifest, DepthRigRole } from "./depthRig";

export type ArtworkView = "front" | "three-quarter-left" | "three-quarter-right" | "profile-left" | "profile-right" | "back";
export type ArtworkLayerState = "complete" | "pending" | "not-required";

export interface DepthRigArtworkLayerV1 {
  nodeId: string;
  role: DepthRigRole;
  assetPath: string;
  image: { sha256: string; widthPx: number; heightPx: number; hasAlpha: boolean };
  framePx: { x: number; y: number; width: number; height: number };
  pivotPx: readonly [number, number];
  zIndex: number;
  occludes: readonly string[];
  hiddenRegions: ArtworkLayerState;
  evidenceIds?: readonly string[];
}

export interface DepthRigArtworkManifestV1 {
  version: 1;
  id: string;
  rigId: string;
  status: "blockout" | "production";
  bodyCoverage: "upper-body" | "full-body";
  coordinateSystem: "canvas-y-down";
  canvas: { widthPx: number; heightPx: number; unitsPerPixel: number };
  source: {
    kind: "layered-png" | "ora-export" | "psd-export" | "svg-export" | "blender";
    assetId: string;
    revision: string;
    licenseStatus: "verified" | "pending" | "restricted";
    licenseReference?: string;
  };
  views: readonly ArtworkView[];
  layers: readonly DepthRigArtworkLayerV1[];
  visualReview: {
    status: "pending" | "approved";
    reviewer?: string;
    reviewId?: string;
    reviewedAt?: string;
  };
}

export interface DepthRigArtworkValidation {
  ok: boolean;
  productionReady: boolean;
  errors: string[];
  warnings: string[];
  missingProductionRoles: DepthRigRole[];
  missingViews: ArtworkView[];
  layerCount: number;
}

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const VIEWS: readonly ArtworkView[] = ["front", "three-quarter-left", "three-quarter-right", "profile-left", "profile-right", "back"];
const UPPER_BODY_ROLES: readonly DepthRigRole[] = [
  "head", "face", "eyes", "hair-front", "hair-back", "neck", "torso",
  "left-upper-arm", "left-forearm", "left-hand",
  "right-upper-arm", "right-forearm", "right-hand",
  "coat-front", "coat-tail",
];
const FULL_BODY_ROLES: readonly DepthRigRole[] = [
  ...UPPER_BODY_ROLES, "skirt-front", "skirt-back",
  "left-thigh", "left-shin", "left-foot", "right-thigh", "right-shin", "right-foot",
];
const MOVABLE_ROLES = new Set<DepthRigRole>([
  "head", "neck", "hair-front", "hair-back", "torso",
  "left-upper-arm", "left-forearm", "left-hand", "right-upper-arm", "right-forearm", "right-hand",
  "coat-front", "coat-tail", "skirt-front", "skirt-back",
  "left-thigh", "left-shin", "left-foot", "right-thigh", "right-shin", "right-foot",
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const inside = (value: number, min: number, max: number) => value >= min && value <= max;
const safeAssetPath = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 240 &&
  !value.startsWith("/") && !value.startsWith("\\") && !/^[a-z]+:/i.test(value) &&
  !value.split(/[\\/]/).some((part) => part === ".." || part === "");

function fail(errors: string[], code: string): void {
  errors.push(code);
}

/**
 * Validate the artist-authored 2.5D layer manifest separately from the runtime
 * DepthRigManifest. A structurally valid blockout is useful for preview, but
 * is deliberately never promoted to production-ready artwork.
 */
export function validateDepthRigArtwork(
  raw: unknown,
  rig: DepthRigManifest,
  evidence?: { renderableNodeIds?: ReadonlySet<string>; texturedNodeIds?: ReadonlySet<string> },
): DepthRigArtworkValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: DepthRigArtworkValidation = {
    ok: false, productionReady: false, errors, warnings,
    missingProductionRoles: [...UPPER_BODY_ROLES], missingViews: ["front", "three-quarter-left", "three-quarter-right"],
    layerCount: 0,
  };
  if (!isRecord(raw)) { fail(errors, "artwork-not-object"); return empty; }
  const m = raw as unknown as DepthRigArtworkManifestV1;
  if (m.version !== 1) fail(errors, "unsupported-artwork-version");
  if (typeof m.id !== "string" || !ID.test(m.id)) fail(errors, "invalid-artwork-id");
  if (typeof m.rigId !== "string" || m.rigId !== rig?.id) fail(errors, "artwork-rig-id-mismatch");
  if (m.status !== "blockout" && m.status !== "production") fail(errors, "invalid-artwork-status");
  if (m.bodyCoverage !== "upper-body" && m.bodyCoverage !== "full-body") fail(errors, "invalid-body-coverage");
  if (m.coordinateSystem !== "canvas-y-down") fail(errors, "unsupported-artwork-coordinate-system");
  if (!isRecord(m.canvas) || !Number.isInteger(m.canvas.widthPx) || !Number.isInteger(m.canvas.heightPx) ||
      !finite(m.canvas.unitsPerPixel) || m.canvas.widthPx <= 0 || m.canvas.heightPx <= 0 ||
      m.canvas.widthPx > 16384 || m.canvas.heightPx > 16384 || m.canvas.unitsPerPixel <= 0 || m.canvas.unitsPerPixel > 10) {
    fail(errors, "invalid-artwork-canvas");
  }
  if (!isRecord(m.source) ||
      !["layered-png", "ora-export", "psd-export", "svg-export", "blender"].includes(String(m.source.kind)) ||
      typeof m.source.assetId !== "string" || !ID.test(m.source.assetId) ||
      typeof m.source.revision !== "string" || m.source.revision.length === 0 || m.source.revision.length > 128 ||
      !["verified", "pending", "restricted"].includes(String(m.source.licenseStatus))) {
    fail(errors, "invalid-artwork-source");
  }
  if (!Array.isArray(m.views) || m.views.some((view) => !VIEWS.includes(view))) fail(errors, "invalid-artwork-views");
  if (!Array.isArray(m.layers) || m.layers.length === 0 || m.layers.length > 128) {
    fail(errors, "invalid-artwork-layer-count");
    return { ...empty, errors: [...new Set(errors)] };
  }
  const rigNodes = new Map((Array.isArray(rig?.nodes) ? rig.nodes : []).map((node) => [node.id, node]));
  const layerIds = new Set<string>();
  const byNode = new Map<string, DepthRigArtworkLayerV1>();
  for (const layer of m.layers) {
    if (!isRecord(layer) || typeof layer.nodeId !== "string" || !ID.test(layer.nodeId)) {
      fail(errors, "invalid-artwork-layer-id");
      continue;
    }
    if (layerIds.has(layer.nodeId)) fail(errors, "duplicate-artwork-layer:" + layer.nodeId);
    layerIds.add(layer.nodeId);
    const rigNode = rigNodes.get(layer.nodeId);
    if (!rigNode) fail(errors, "artwork-node-not-in-rig:" + layer.nodeId);
    else if (rigNode.role !== layer.role) fail(errors, "artwork-role-mismatch:" + layer.nodeId);
    byNode.set(layer.nodeId, layer);
    if (!safeAssetPath(layer.assetPath)) fail(errors, "unsafe-artwork-asset-path:" + layer.nodeId);
    if (!isRecord(layer.image) || !SHA256.test(String(layer.image.sha256)) ||
        !Number.isInteger(layer.image.widthPx) || !Number.isInteger(layer.image.heightPx) ||
        (layer.image.widthPx as number) <= 0 || (layer.image.heightPx as number) <= 0 ||
        (layer.image.widthPx as number) > 8192 || (layer.image.heightPx as number) > 8192 ||
        layer.image.hasAlpha !== true) fail(errors, "invalid-artwork-image:" + layer.nodeId);
    if (!isRecord(layer.framePx) || ![layer.framePx.x, layer.framePx.y, layer.framePx.width, layer.framePx.height].every(finite) ||
        layer.framePx.x < 0 || layer.framePx.y < 0 || layer.framePx.width <= 0 || layer.framePx.height <= 0 ||
        !isRecord(m.canvas) || layer.framePx.x + layer.framePx.width > m.canvas.widthPx ||
        layer.framePx.y + layer.framePx.height > m.canvas.heightPx ||
        !isRecord(layer.image) || layer.framePx.width !== layer.image.widthPx || layer.framePx.height !== layer.image.heightPx) {
      fail(errors, "artwork-frame-out-of-bounds:" + layer.nodeId);
    }
    if (!Array.isArray(layer.pivotPx) || layer.pivotPx.length !== 2 ||
        !layer.pivotPx.every(finite) || layer.pivotPx[0] < 0 || layer.pivotPx[1] < 0 ||
        !isRecord(layer.image) || layer.pivotPx[0] > layer.image.widthPx || layer.pivotPx[1] > layer.image.heightPx) {
      fail(errors, "artwork-pivot-out-of-bounds:" + layer.nodeId);
    }
    if (!finite(layer.zIndex)) fail(errors, "invalid-artwork-z-index:" + layer.nodeId);
    if (!Array.isArray(layer.occludes) || layer.occludes.some((id) => typeof id !== "string")) {
      fail(errors, "invalid-artwork-occlusion:" + layer.nodeId);
    }
    if (!["complete", "pending", "not-required"].includes(String(layer.hiddenRegions))) {
      fail(errors, "invalid-hidden-region-state:" + layer.nodeId);
    }
    if (Array.isArray(layer.evidenceIds) && layer.evidenceIds.some((id) => typeof id !== "string" || id.length > 128)) {
      fail(errors, "invalid-hidden-region-evidence:" + layer.nodeId);
    }
  }

  for (const layer of m.layers) {
    if (!isRecord(layer) || typeof layer.nodeId !== "string" || !Array.isArray(layer.occludes)) continue;
    for (const occludedId of layer.occludes) {
      const target = byNode.get(occludedId);
      if (!target) fail(errors, "occlusion-target-missing:" + layer.nodeId + ":" + occludedId);
      else if (!finite(layer.zIndex) || !finite(target.zIndex) || layer.zIndex <= target.zIndex) {
        fail(errors, "occlusion-order-invalid:" + layer.nodeId + ":" + occludedId);
      }
    }
  }

  const requiredRoles = m.bodyCoverage === "full-body" ? FULL_BODY_ROLES : UPPER_BODY_ROLES;
  const roleSet = new Set(m.layers.filter(isRecord).map((layer) => layer.role));
  const missingProductionRoles = requiredRoles.filter((role) => !roleSet.has(role));
  const requiredViews: ArtworkView[] = ["front", "three-quarter-left", "three-quarter-right"];
  const missingViews = requiredViews.filter((view) => !Array.isArray(m.views) || !m.views.includes(view));
  if (missingProductionRoles.length) warnings.push("missing-production-roles:" + missingProductionRoles.join(","));
  if (missingViews.length) warnings.push("missing-production-views:" + missingViews.join(","));
  if (m.source?.licenseStatus !== "verified") warnings.push("artwork-license-not-verified");
  if (m.visualReview?.status !== "approved" || !m.visualReview?.reviewId || !m.visualReview?.reviewedAt) {
    warnings.push("artwork-visual-review-not-approved");
  }
  for (const layer of m.layers) {
    if (!isRecord(layer) || typeof layer.nodeId !== "string") continue;
    if (MOVABLE_ROLES.has(layer.role) && layer.hiddenRegions !== "complete") {
      warnings.push("hidden-regions-incomplete:" + layer.nodeId);
    }
    if (MOVABLE_ROLES.has(layer.role) && (!Array.isArray(layer.evidenceIds) || layer.evidenceIds.length === 0)) {
      warnings.push("hidden-region-evidence-missing:" + layer.nodeId);
    }
  }
  const renderable = evidence?.renderableNodeIds;
  const textured = evidence?.texturedNodeIds;
  if (renderable) {
    for (const id of layerIds) if (!renderable.has(id)) fail(errors, "artwork-node-not-renderable:" + id);
  } else warnings.push("renderer-geometry-evidence-not-provided");
  if (textured) {
    for (const id of layerIds) if (!textured.has(id)) fail(errors, "artwork-node-not-textured:" + id);
  } else warnings.push("renderer-texture-evidence-not-provided");

  const ok = errors.length === 0;
  const productionReady = ok && m.status === "production" &&
    missingProductionRoles.length === 0 && missingViews.length === 0 &&
    m.source?.licenseStatus === "verified" &&
    m.visualReview?.status === "approved" && Boolean(m.visualReview?.reviewId && m.visualReview?.reviewedAt) &&
    Boolean(renderable && textured) &&
    m.layers.every((layer) => !MOVABLE_ROLES.has(layer.role) ||
      (layer.hiddenRegions === "complete" && Array.isArray(layer.evidenceIds) && layer.evidenceIds.length > 0));
  return {
    ok, productionReady, errors: [...new Set(errors)], warnings: [...new Set(warnings)],
    missingProductionRoles, missingViews, layerCount: m.layers.length,
  };
}
