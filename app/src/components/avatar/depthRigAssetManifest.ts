import { validateDepthRig, type DepthRigDefinition } from "./depthRig.ts";

/**
 * Versioned preflight contract for authored 2.5D artwork.
 *
 * A valid pose rig is not, by itself, a production puppet. This manifest binds
 * every required rig node to a real transparent layer, an authored canvas
 * rectangle, deformation/hidden-paint declarations, occlusion masks and
 * auditable provenance. The inventory must be produced from the actual asset
 * directory by the caller; manifest declarations alone never prove a file exists.
 */

export interface DepthRigAssetManifestV1 {
  version: 1;
  id: string;
  rigId: string;
  canvas: { width: number; height: number };
  requiredNodeIds: readonly string[];
  provenance: {
    creator: string;
    licenseId: string;
    reviewStatus: "approved" | "review-required" | "restricted";
    reviewedBy: string;
    reviewedAt: string;
    evidencePath: string;
  };
  assets: readonly {
    nodeId: string;
    assetPath: string;
    pixelSize: { width: number; height: number };
    canvasRect: { x: number; y: number; width: number; height: number };
    deforms: boolean;
    hiddenAreaPaint: "complete" | "partial" | "not-required" | "missing";
    occlusionMaskPaths: readonly string[];
  }[];
}

export interface DepthRigAssetInventoryEntry {
  path: string;
  kind: "image" | "mask" | "evidence";
  width?: number;
  height?: number;
  hasAlpha?: boolean;
  byteLength: number;
}

export interface DepthRigAssetDiagnostic {
  severity: "error" | "warning";
  code:
    | "invalid-rig" | "invalid-manifest" | "invalid-canvas" | "rig-mismatch"
    | "unknown-required-node" | "duplicate-required-node" | "missing-required-layer"
    | "unknown-node" | "duplicate-node-layer" | "unsafe-path" | "asset-not-found"
    | "asset-kind-mismatch" | "asset-metadata-mismatch" | "asset-without-alpha"
    | "invalid-rect" | "missing-hidden-paint" | "missing-mask" | "mask-not-found"
    | "invalid-provenance" | "license-not-approved" | "license-evidence-missing"
    | "duplicate-inventory-path" | "invalid-inventory-entry";
  nodeId?: string;
  path?: string;
  message: string;
}

export interface DepthRigAssetManifestValidation {
  status: "asset-preflight-pass" | "blocked";
  diagnostics: DepthRigAssetDiagnostic[];
  checkedLayers: number;
  checkedMasks: number;
}

type RecordValue = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is RecordValue => {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const own = (value: unknown, key: string): unknown => {
  if (!isPlainRecord(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
};

const values = (value: unknown, maximum = 4096): unknown[] | null => {
  try {
    if (!Array.isArray(value)) return null;
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
};

const nonEmptyString = (value: unknown, maximum = 512): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const safeRelativePath = (value: unknown): value is string => {
  if (!nonEmptyString(value, 1024) || value.startsWith("/") || value.includes("\\\\")
    || /[\\u0000-\\u001f?#:]/.test(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
};

const diagnostic = (
  code: DepthRigAssetDiagnostic["code"],
  message: string,
  options: { nodeId?: string; path?: string } = {},
): DepthRigAssetDiagnostic => ({ severity: "error", code, message, ...options });

/**
 * Validate an authored 2.5D pack against a rig and a filesystem-derived
 * inventory. "asset-preflight-pass" means the contract is complete; it does
 * not replace visual review, device rendering tests or human license approval.
 */
export function validateDepthRigAssetManifest(
  rig: DepthRigDefinition,
  rawManifest: unknown,
  rawInventory: unknown,
): DepthRigAssetManifestValidation {
  const diagnostics: DepthRigAssetDiagnostic[] = [];
  let checkedLayers = 0;
  let checkedMasks = 0;

  try {
    const rigDiagnostics = validateDepthRig(rig);
    if (rigDiagnostics.length) {
      diagnostics.push(diagnostic("invalid-rig", `Rig validation failed: ${rigDiagnostics.map((item) => item.code).join(", ")}.`));
      return { status: "blocked", diagnostics, checkedLayers, checkedMasks };
    }

    const manifest = isPlainRecord(rawManifest) ? rawManifest : null;
    if (!manifest || own(manifest, "version") !== 1
      || !nonEmptyString(own(manifest, "id"), 128)
      || !nonEmptyString(own(manifest, "rigId"), 128)) {
      diagnostics.push(diagnostic("invalid-manifest", "Manifest must be a plain version-1 record with a bounded id and rigId."));
      return { status: "blocked", diagnostics, checkedLayers, checkedMasks };
    }

    const rigId = own(manifest, "rigId");
    if (rigId !== rig.id) diagnostics.push(diagnostic("rig-mismatch", `Manifest rigId ${String(rigId)} does not match ${rig.id}.`));

    const canvas = own(manifest, "canvas");
    const canvasWidth = own(canvas, "width");
    const canvasHeight = own(canvas, "height");
    if (!isPlainRecord(canvas) || !positiveInteger(canvasWidth) || !positiveInteger(canvasHeight)
      || canvasWidth < 256 || canvasHeight < 256 || canvasWidth > 8192 || canvasHeight > 8192) {
      diagnostics.push(diagnostic("invalid-canvas", "Canvas dimensions must be integer pixels within 256..8192."));
      return { status: "blocked", diagnostics, checkedLayers, checkedMasks };
    }

    const requiredNodeIds = values(own(manifest, "requiredNodeIds"), 256);
    const assets = values(own(manifest, "assets"), 512);
    const inventory = values(rawInventory, 8192);
    if (!requiredNodeIds || !requiredNodeIds.length || !assets || !inventory) {
      diagnostics.push(diagnostic("invalid-manifest", "requiredNodeIds, assets and the filesystem inventory must be dense bounded arrays."));
      return { status: "blocked", diagnostics, checkedLayers, checkedMasks };
    }

    const rigNodeIds = new Set(rig.nodes.map((node) => node.id));
    const required = new Set<string>();
    for (const candidate of requiredNodeIds) {
      if (!nonEmptyString(candidate, 192)) {
        diagnostics.push(diagnostic("invalid-manifest", "Every requiredNodeId must be a non-empty string."));
        continue;
      }
      if (required.has(candidate)) diagnostics.push(diagnostic("duplicate-required-node", `Required node ${candidate} is listed more than once.`, { nodeId: candidate }));
      required.add(candidate);
      if (!rigNodeIds.has(candidate)) diagnostics.push(diagnostic("unknown-required-node", `Required node ${candidate} is absent from the rig.`, { nodeId: candidate }));
    }

    const files = new Map<string, RecordValue>();
    for (const candidate of inventory) {
      if (!isPlainRecord(candidate)) {
        diagnostics.push(diagnostic("invalid-inventory-entry", "Every inventory entry must be a plain record."));
        continue;
      }
      const path = own(candidate, "path");
      const kind = own(candidate, "kind");
      const byteLength = own(candidate, "byteLength");
      if (!safeRelativePath(path) || !["image", "mask", "evidence"].includes(String(kind))
        || !positiveInteger(byteLength)) {
        diagnostics.push(diagnostic("invalid-inventory-entry", "Inventory entries need a safe relative path, supported kind and positive byteLength.", {
          path: typeof path === "string" ? path : undefined,
        }));
        continue;
      }
      if (files.has(path)) {
        diagnostics.push(diagnostic("duplicate-inventory-path", `Inventory path ${path} is duplicated.`, { path }));
        continue;
      }
      files.set(path, candidate);
    }

    const mapped = new Set<string>();
    for (const candidate of assets) {
      if (!isPlainRecord(candidate)) {
        diagnostics.push(diagnostic("invalid-manifest", "Every asset layer must be a plain record."));
        continue;
      }
      const nodeId = own(candidate, "nodeId");
      const assetPath = own(candidate, "assetPath");
      if (!nonEmptyString(nodeId, 192) || !rigNodeIds.has(nodeId)) {
        diagnostics.push(diagnostic("unknown-node", "Asset layer references a node that is absent from the rig.", {
          nodeId: typeof nodeId === "string" ? nodeId : undefined,
        }));
        continue;
      }
      if (mapped.has(nodeId)) {
        diagnostics.push(diagnostic("duplicate-node-layer", `Rig node ${nodeId} has more than one primary asset layer.`, { nodeId }));
        continue;
      }
      mapped.add(nodeId);
      checkedLayers += 1;

      if (!safeRelativePath(assetPath)) {
        diagnostics.push(diagnostic("unsafe-path", "Asset paths must be safe relative paths without traversal or URL syntax.", {
          nodeId, path: typeof assetPath === "string" ? assetPath : undefined,
        }));
      }
      const file = safeRelativePath(assetPath) ? files.get(assetPath) : undefined;
      if (!file) diagnostics.push(diagnostic("asset-not-found", "Primary layer is absent from the filesystem inventory.", { nodeId, path: typeof assetPath === "string" ? assetPath : undefined }));
      else if (own(file, "kind") !== "image") diagnostics.push(diagnostic("asset-kind-mismatch", "Primary layer path must resolve to an image asset.", { nodeId, path: assetPath }));

      const pixelSize = own(candidate, "pixelSize");
      const declaredWidth = own(pixelSize, "width");
      const declaredHeight = own(pixelSize, "height");
      if (!isPlainRecord(pixelSize) || !positiveInteger(declaredWidth) || !positiveInteger(declaredHeight)) {
        diagnostics.push(diagnostic("asset-metadata-mismatch", "pixelSize must contain positive integer width and height.", { nodeId }));
      } else if (file && (own(file, "width") !== declaredWidth || own(file, "height") !== declaredHeight)) {
        diagnostics.push(diagnostic("asset-metadata-mismatch", "Declared pixelSize differs from the filesystem inventory.", { nodeId, path: assetPath }));
      }
      if (file && own(file, "hasAlpha") !== true) {
        diagnostics.push(diagnostic("asset-without-alpha", "Layer images must contain an alpha channel for cutout compositing.", { nodeId, path: assetPath }));
      }

      const rect = own(candidate, "canvasRect");
      const x = own(rect, "x"), y = own(rect, "y"), width = own(rect, "width"), height = own(rect, "height");
      if (!isPlainRecord(rect) || ![x, y, width, height].every((value) => typeof value === "number" && Number.isSafeInteger(value))
        || (x as number) < 0 || (y as number) < 0 || (width as number) <= 0 || (height as number) <= 0
        || (x as number) + (width as number) > canvasWidth || (y as number) + (height as number) > canvasHeight) {
        diagnostics.push(diagnostic("invalid-rect", "Layer canvasRect must be an integer rectangle fully inside the shared canvas.", { nodeId }));
      }

      const deforms = own(candidate, "deforms");
      const hiddenAreaPaint = own(candidate, "hiddenAreaPaint");
      if (typeof deforms !== "boolean" || !["complete", "partial", "not-required", "missing"].includes(String(hiddenAreaPaint))) {
        diagnostics.push(diagnostic("invalid-manifest", "Layer deformation and hiddenAreaPaint declarations are required.", { nodeId }));
      } else if (deforms && hiddenAreaPaint !== "complete") {
        diagnostics.push(diagnostic("missing-hidden-paint", "A deforming layer requires complete hidden-area paint to prevent gaps during motion.", { nodeId }));
      }

      const masks = values(own(candidate, "occlusionMaskPaths"), 128);
      if (!masks) {
        diagnostics.push(diagnostic("invalid-manifest", "occlusionMaskPaths must be a dense array.", { nodeId }));
      } else {
        if (deforms && masks.length === 0) diagnostics.push(diagnostic("missing-mask", "A deforming layer requires at least one authored occlusion mask.", { nodeId }));
        const seenMasks = new Set<string>();
        for (const maskPath of masks) {
          if (!safeRelativePath(maskPath)) {
            diagnostics.push(diagnostic("unsafe-path", "Mask paths must be safe relative paths.", { nodeId, path: typeof maskPath === "string" ? maskPath : undefined }));
            continue;
          }
          if (seenMasks.has(maskPath)) {
            diagnostics.push(diagnostic("invalid-manifest", "A mask path may only be listed once per layer.", { nodeId, path: maskPath }));
            continue;
          }
          seenMasks.add(maskPath);
          const mask = files.get(maskPath);
          if (!mask || own(mask, "kind") !== "mask") diagnostics.push(diagnostic("mask-not-found", "Occlusion mask is absent from the inventory or is not typed as a mask.", { nodeId, path: maskPath }));
          else checkedMasks += 1;
        }
      }
    }

    for (const nodeId of required) {
      if (rigNodeIds.has(nodeId) && !mapped.has(nodeId)) {
        diagnostics.push(diagnostic("missing-required-layer", `Required rig node ${nodeId} has no primary artwork layer.`, { nodeId }));
      }
    }

    const provenance = own(manifest, "provenance");
    const creator = own(provenance, "creator");
    const licenseId = own(provenance, "licenseId");
    const reviewStatus = own(provenance, "reviewStatus");
    const reviewedBy = own(provenance, "reviewedBy");
    const reviewedAt = own(provenance, "reviewedAt");
    const evidencePath = own(provenance, "evidencePath");
    if (!isPlainRecord(provenance) || !nonEmptyString(creator) || !nonEmptyString(licenseId)
      || !nonEmptyString(reviewedBy) || !nonEmptyString(reviewedAt)
      || !Number.isFinite(Date.parse(reviewedAt)) || !safeRelativePath(evidencePath)
      || !["approved", "review-required", "restricted"].includes(String(reviewStatus))) {
      diagnostics.push(diagnostic("invalid-provenance", "Provenance must identify creator, license, reviewer, review date, status and a safe evidence path."));
    }
    if (reviewStatus !== "approved") {
      diagnostics.push(diagnostic("license-not-approved", "2.5D assets cannot pass preflight until a human reviewer explicitly approves their license status."));
    }
    const evidence = safeRelativePath(evidencePath) ? files.get(evidencePath) : undefined;
    if (!evidence || own(evidence, "kind") !== "evidence") {
      diagnostics.push(diagnostic("license-evidence-missing", "License evidence file is absent from the filesystem inventory or has the wrong kind.", {
        path: typeof evidencePath === "string" ? evidencePath : undefined,
      }));
    }
  } catch {
    diagnostics.push(diagnostic("invalid-manifest", "Manifest or inventory contains inaccessible, proxy-backed or malformed data; preflight failed closed."));
  }

  return {
    status: diagnostics.some((item) => item.severity === "error") ? "blocked" : "asset-preflight-pass",
    diagnostics,
    checkedLayers,
    checkedMasks,
  };
}
