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
    if (!asset || typeof asset !== "object") {
      errors.push("asset:not-object");
      continue;
    }
    if (!ID.test(asset.id ?? "")) errors.push("asset:invalid-id");
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
    const mimeByExtension: Record<string, string> = {
      png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg",
      glb: "model/gltf-binary", vrm: "model/gltf-binary", gltf: "model/gltf+json",
    };
    const extension = String(asset.path ?? "").split(".").pop()?.toLowerCase() ?? "";
    if (mimeByExtension[extension] !== asset.mime) errors.push(`asset:mime-extension-mismatch:${asset?.id ?? "unknown"}`);
  }
  if (totalBytes > 128 * 1024 * 1024) errors.push("manifest:pack-size-limit-exceeded");
  return { valid: errors.length === 0, errors, totalBytes };
}

export interface WardrobeAssetByteVerification {
  valid: boolean;
  reason: "verified" | "size-mismatch" | "hash-mismatch" | "crypto-unavailable" | "invalid-input";
  actualBytes: number;
  actualSha256?: string;
}

/**
 * Verify downloaded/local bytes against the manifest declaration.
 * Web Crypto keeps this usable in browsers and supported Node runtimes.
 * License/provenance review remains a separate activation gate.
 */
export async function verifyWardrobeAssetBytes(
  asset: Pick<WardrobePackAsset, "bytes" | "sha256">,
  input: ArrayBuffer | Uint8Array,
  cryptoProvider: Pick<Crypto, "subtle"> | undefined = globalThis.crypto,
): Promise<WardrobeAssetByteVerification> {
  if (!asset || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !SHA256.test(asset.sha256 ?? "")) {
    return { valid: false, reason: "invalid-input", actualBytes: 0 };
  }
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength !== asset.bytes) {
    return { valid: false, reason: "size-mismatch", actualBytes: bytes.byteLength };
  }
  if (!cryptoProvider?.subtle) {
    return { valid: false, reason: "crypto-unavailable", actualBytes: bytes.byteLength };
  }
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  const actualSha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  if (actualSha256.toLowerCase() !== asset.sha256.toLowerCase()) {
    return { valid: false, reason: "hash-mismatch", actualBytes: bytes.byteLength, actualSha256 };
  }
  return { valid: true, reason: "verified", actualBytes: bytes.byteLength, actualSha256 };
}

export interface WardrobePackPayloadVerification {
  valid: boolean;
  reason: "verified" | "manifest-invalid" | "missing-file" | "unexpected-file" | "asset-invalid";
  verifiedAssetIds: string[];
  failures: Array<{ path: string; reason: WardrobeAssetByteVerification["reason"] | "missing-file" }>;
}

/** Whole-pack gate: every declared path must exist and pass its own byte check. */
export async function verifyWardrobePackPayload(
  manifest: WardrobePackManifest,
  files: ReadonlyMap<string, ArrayBuffer | Uint8Array>,
  cryptoProvider: Pick<Crypto, "subtle"> | undefined = globalThis.crypto,
): Promise<WardrobePackPayloadVerification> {
  if (!validateWardrobePackManifest(manifest).valid) {
    return { valid: false, reason: "manifest-invalid", verifiedAssetIds: [], failures: [] };
  }
  const declaredPaths = new Set(manifest.assets.map((asset) => asset.path));
  for (const path of files.keys()) {
    if (!declaredPaths.has(path)) {
      return { valid: false, reason: "unexpected-file", verifiedAssetIds: [], failures: [{ path, reason: "invalid-input" }] };
    }
  }
  const verifiedAssetIds: string[] = [];
  const failures: WardrobePackPayloadVerification["failures"] = [];
  for (const asset of manifest.assets) {
    const bytes = files.get(asset.path);
    if (!bytes) {
      failures.push({ path: asset.path, reason: "missing-file" });
      continue;
    }
    const result = await verifyWardrobeAssetBytes(asset, bytes, cryptoProvider);
    if (result.valid) verifiedAssetIds.push(asset.id);
    else failures.push({ path: asset.path, reason: result.reason });
  }
  if (failures.length) {
    return {
      valid: false,
      reason: failures.some((failure) => failure.reason === "missing-file") ? "missing-file" : "asset-invalid",
      verifiedAssetIds,
      failures,
    };
  }
  return { valid: true, reason: "verified", verifiedAssetIds, failures: [] };
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
  if (!Array.isArray(request.expectedAssetIds) || request.expectedAssetIds.length === 0 || request.expectedAssetIds.some((id) => !nonEmpty(id, 120))) errors.push("switch:no-renderable-assets");
  if (new Set(request.expectedAssetIds ?? []).size !== (request.expectedAssetIds ?? []).length) errors.push("switch:duplicate-asset-id");
  if (!RENDERERS.includes(request.renderer)) errors.push("switch:invalid-renderer");
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
