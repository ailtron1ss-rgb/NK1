import { MAX_AVATAR_MODEL_BYTES } from "./avatarModelLimits.ts";

export interface AvatarModelPreflightResult {
  readonly format: "glb" | "vrm";
  readonly byteLength: number;
  readonly hasBinaryChunk: boolean;
  readonly extensionsUsed: readonly string[];
}

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

function reject(reason: string): never {
  throw new Error(reason);
}

/**
 * Validate the GLB container before handing untrusted bytes to GLTFLoader.
 * Only self-contained GLB/VRM files are accepted because the avatar is stored
 * as one browser-local Blob and parsed without a network resource resolver.
 */
export function preflightAvatarModel(
  input: ArrayBuffer | Uint8Array,
  filename: string,
): AvatarModelPreflightResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_AVATAR_MODEL_BYTES) {
    return reject("avatar-size-invalid");
  }

  const safeName = String(filename ?? "").toLowerCase();
  if (!safeName.endsWith(".glb") && !safeName.endsWith(".vrm")) {
    return reject("avatar-extension-unsupported");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return reject("glb-magic-invalid");
  if (view.getUint32(4, true) !== 2) return reject("glb-version-unsupported");
  if (view.getUint32(8, true) !== bytes.byteLength) return reject("glb-length-mismatch");

  let offset = 12;
  let chunkIndex = 0;
  let jsonBytes: Uint8Array | null = null;
  let binaryChunkLength = 0;
  let hasBinaryChunk = false;

  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 8) return reject("glb-chunk-header-truncated");
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkLength === 0 || chunkLength % 4 !== 0) return reject("glb-chunk-alignment-invalid");
    if (chunkEnd > bytes.byteLength) return reject("glb-chunk-out-of-bounds");

    if (chunkIndex === 0 && chunkType !== GLB_JSON_CHUNK) return reject("glb-json-chunk-must-be-first");
    if (chunkType === GLB_JSON_CHUNK) {
      if (jsonBytes) return reject("glb-json-chunk-duplicate");
      if (chunkIndex !== 0) return reject("glb-json-chunk-must-be-first");
      jsonBytes = bytes.subarray(chunkStart, chunkEnd);
    } else if (chunkType === GLB_BIN_CHUNK) {
      if (chunkIndex !== 1) return reject("glb-bin-chunk-must-be-second");
      if (hasBinaryChunk) return reject("glb-bin-chunk-duplicate");
      hasBinaryChunk = true;
      binaryChunkLength = chunkLength;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (!jsonBytes) return reject("glb-json-chunk-missing");

  let document: Record<string, unknown>;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes);
    const parsed: unknown = JSON.parse(decoded.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject("gltf-json-invalid");
    document = parsed as Record<string, unknown>;
  } catch {
    return reject("gltf-json-invalid");
  }

  const asset = document.asset;
  if (!asset || typeof asset !== "object" || (asset as Record<string, unknown>).version !== "2.0") {
    return reject("gltf-asset-version-invalid");
  }

  const buffers = document.buffers;
  if (buffers !== undefined && !Array.isArray(buffers)) return reject("gltf-buffers-invalid");
  for (const entry of (Array.isArray(buffers) ? buffers : []) as unknown[]) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return reject("gltf-buffer-invalid");
    const buffer = entry as Record<string, unknown>;
    if (buffer.uri !== undefined && typeof buffer.uri !== "string") return reject("gltf-buffer-uri-invalid");
    if (typeof buffer.uri === "string" && !buffer.uri.startsWith("data:")) {
      return reject("external-buffer-uri-unsupported");
    }
    if (!Number.isSafeInteger(buffer.byteLength) || Number(buffer.byteLength) <= 0) {
      return reject("gltf-buffer-length-invalid");
    }
    if (buffer.uri === undefined && Number(buffer.byteLength ?? 0) > binaryChunkLength) {
      return reject("glb-bin-chunk-too-small");
    }
    if (buffer.uri === undefined && Number(buffer.byteLength ?? 0) > 0 && !hasBinaryChunk) {
      return reject("glb-bin-chunk-missing");
    }
  }

  const images = document.images;
  if (images !== undefined && !Array.isArray(images)) return reject("gltf-images-invalid");
  for (const entry of (Array.isArray(images) ? images : []) as unknown[]) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return reject("gltf-image-invalid");
    const image = entry as Record<string, unknown>;
    if (image.uri !== undefined && typeof image.uri !== "string") return reject("gltf-image-uri-invalid");
    if (typeof image.uri === "string" && !image.uri.startsWith("data:")) {
      return reject("external-image-uri-unsupported");
    }
  }

  const used = document.extensionsUsed;
  if (used !== undefined && (!Array.isArray(used) || used.some((value) => typeof value !== "string"))) {
    return reject("gltf-extensions-invalid");
  }
  const extensionsUsed = (Array.isArray(used) ? used : []) as string[];
  const required = document.extensionsRequired;
  if (required !== undefined && (!Array.isArray(required) || required.some((value) => typeof value !== "string"))) {
    return reject("gltf-extensions-invalid");
  }
  if (Array.isArray(required) && required.some((extension) => !extensionsUsed.includes(extension as string))) {
    return reject("gltf-required-extension-missing");
  }
  const format = extensionsUsed.some((extension) => extension === "VRMC_vrm" || extension === "VRM") ? "vrm" : "glb";
  if (safeName.endsWith(".vrm") && format !== "vrm") return reject("vrm-extension-missing");

  return Object.freeze({
    format,
    byteLength: bytes.byteLength,
    hasBinaryChunk,
    extensionsUsed: Object.freeze([...extensionsUsed]),
  });
}
