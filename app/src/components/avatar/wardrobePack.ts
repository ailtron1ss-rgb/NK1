import { isSafeWardrobeAssetPath, type WardrobeRenderer, type WardrobeSlot } from "./wardrobeSystem.ts";

export const MAX_WARDROBE_ASSET_BYTES = 32 * 1024 * 1024;
export const MAX_WARDROBE_PACK_ASSETS = 128;

export interface WardrobePackAsset {
  id: string;
  garmentId: string;
  slot: WardrobeSlot;
  renderer: WardrobeRenderer;
  path: string;
  sha256: string;
  bytes: number;
  mime: "image/png" | "image/webp" | "image/jpeg" | "model/gltf-binary" | "model/gltf+json";
}
export interface WardrobePackManifest {
  schemaVersion: 1;
  packId: string;
  version: string;
  creator: string;
  source: string;
  licenseId: string;
  attribution: string;
  targetBodyId: string;
  targetRigVersion: string;
  assets: WardrobePackAsset[];
}
export interface WardrobePackValidation {
  valid: boolean;
  errors: string[];
  totalBytes: number;
}

const ID = /^[a-z0-9][a-z0-9._-]{1,79}$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;
const SHA256 = /^[a-f0-9]{64}$/iu;
const RENDERERS: readonly WardrobeRenderer[] = ["live2d", "depth2d", "vrm3d"];
const SLOTS: readonly WardrobeSlot[] = ["outerwear", "top", "bottom", "footwear", "hair", "hairAccessory", "neckAccessory", "earAccessory", "wristAccessory", "handheld"];

function nonEmpty(value: unknown, max = 240): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

/** Structural gate only: the caller must still verify file bytes against sha256. */
export function validateWardrobePackManifest(manifest: WardrobePackManifest): WardrobePackValidation {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== "object") return { valid: false, errors: ["manifest:not-object"], totalBytes: 0 };
  if (manifest.schemaVersion !== 1) errors.push("manifest:unsupported-schema");
  if (!ID.test(manifest.packId ?? "")) errors.push("manifest:invalid-pack-id");
  if (!SEMVER.test(manifest.version ?? "")) errors.push("manifest:invalid-version");
  if (!nonEmpty(manifest.creator)) errors.push("manifest:creator-required");
  if (!nonEmpty(manifest.source) || !/^https:\/\//iu.test(manifest.source)) errors.push("manifest:source-must-be-https");
  if (!nonEmpty(manifest.licenseId, 120)) errors.push("manifest:license-required");
  if (!nonEmpty(manifest.attribution)) errors.push("manifest:attribution-required");
  if (!nonEmpty(manifest.targetBodyId, 120)) errors.push("manifest:target-body-required");
  if (!nonEmpty(manifest.targetRigVersion, 80)) errors.push("manifest:target-rig-required");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0 || manifest.assets.length > MAX_WARDROBE_PACK_ASSETS) {
    errors.push("manifest:asset-count-out-of-range");
    return { valid: false, errors, totalBytes: 0 };
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    if (!asset || !ID.test(asset.id ?? "")) errors.push("asset:invalid-id");
    else if (ids.has(asset.id)) errors.push(`asset:duplicate-id:${asset.id}`);
    else ids.add(asset.id);
    if (!nonEmpty(asset.garmentId, 100)) errors.push(`asset:invalid-garment-id:${asset?.id ?? "unknown"}`);
    if (!SLOTS.includes(asset.slot)) errors.push(`asset:invalid-slot:${asset?.id ?? "unknown"}`);
    if (!RENDERERS.includes(asset.renderer)) errors.push(`asset:invalid-renderer:${asset?.id ?? "unknown"}`);
    if (!isSafeWardrobeAssetPath(asset.path ?? "")) errors.push(`asset:unsafe-path:${asset?.id ?? "unknown"}`);
    else if (paths.has(asset.path)) errors.push(`asset:duplicate-path:${asset.path}`);
    else paths.add(asset.path);
    if (!SHA256.test(asset.sha256 ?? "")) errors.push(`asset:invalid-sha256:${asset?.id ?? "unknown"}`);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_WARDROBE_ASSET_BYTES) {
      errors.push(`asset:invalid-size:${asset?.id ?? "unknown"}`);
    } else totalBytes += asset.bytes;
    if (!["image/png", "image/webp", "image/jpeg", "model/gltf-binary", "model/gltf+json"].includes(asset.mime)) {
      errors.push(`asset:unsupported-mime:${asset?.id ?? "unknown"}`);
    }
  }
  if (totalBytes > 128 * 1024 * 1024) errors.push("manifest:pack-size-limit-exceeded");
  return { valid: errors.length === 0, errors, totalBytes };
}

export interface WardrobeSwitchRequest {
  requestId: string;
  fromOutfitId: string;
  toOutfitId: string;
  renderer: WardrobeRenderer;
  expectedAssetIds: string[];
  targetBodyId: string;
  targetRigVersion: string;
  packBodyId: string;
  packRigVersion: string;
  packValidated: boolean;
}
export interface WardrobeSwitchPlan {
  status: "ready" | "blocked";
  requestId: string;
  renderer: WardrobeRenderer;
  previousOutfitId: string;
  nextOutfitId: string;
  expectedAssetIds: string[];
  errors: string[];
}
export interface WardrobeSwitchResult {
  committed: boolean;
  activeOutfitId: string;
  rolledBack: boolean;
  reason: string;
}

/** Plan first; the active appearance must not change before renderer acknowledgement. */
export function createWardrobeSwitchPlan(request: WardrobeSwitchRequest): WardrobeSwitchPlan {
  const errors: string[] = [];
  if (!nonEmpty(request.requestId, 120)) errors.push("switch:request-id-required");
  if (!request.packValidated) errors.push("switch:pack-not-validated");
  if (request.targetBodyId !== request.packBodyId) errors.push("switch:body-mismatch");
  if (request.targetRigVersion !== request.packRigVersion) errors.push("switch:rig-mismatch");
  if (!request.toOutfitId || request.toOutfitId === request.fromOutfitId) errors.push("switch:invalid-target");
  if (!Array.isArray(request.expectedAssetIds) || request.expectedAssetIds.length === 0) errors.push("switch:no-renderable-assets");
  if (new Set(request.expectedAssetIds ?? []).size !== (request.expectedAssetIds ?? []).length) errors.push("switch:duplicate-asset-id");
  return {
    status: errors.length ? "blocked" : "ready",
    requestId: request.requestId,
    renderer: request.renderer,
    previousOutfitId: request.fromOutfitId,
    nextOutfitId: request.toOutfitId,
    expectedAssetIds: [...(request.expectedAssetIds ?? [])],
    errors,
  };
}

/** Commit only if every requested asset was loaded for this exact switch request. */
export function acknowledgeWardrobeSwitch(
  plan: WardrobeSwitchPlan,
  acknowledgement: { requestId: string; success: boolean; loadedAssetIds: string[]; error?: string },
): WardrobeSwitchResult {
  if (plan.status !== "ready") return { committed: false, activeOutfitId: plan.previousOutfitId, rolledBack: false, reason: "plan-blocked" };
  if (acknowledgement.requestId !== plan.requestId) return { committed: false, activeOutfitId: plan.previousOutfitId, rolledBack: false, reason: "stale-acknowledgement" };
  const loaded = new Set(acknowledgement.loadedAssetIds ?? []);
  const complete = plan.expectedAssetIds.every((id) => loaded.has(id)) && loaded.size === plan.expectedAssetIds.length;
  if (!acknowledgement.success || !complete) {
    return { committed: false, activeOutfitId: plan.previousOutfitId, rolledBack: true, reason: acknowledgement.error || "renderer-load-incomplete" };
  }
  return { committed: true, activeOutfitId: plan.nextOutfitId, rolledBack: false, reason: "renderer-acknowledged" };
}
