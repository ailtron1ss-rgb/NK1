import {
  MAX_AVATAR_ACCESSOR_ELEMENTS,
  MAX_AVATAR_ACCESSORS,
  MAX_AVATAR_ANIMATIONS,
  MAX_AVATAR_BUFFERS,
  MAX_AVATAR_BUFFER_VIEWS,
  MAX_AVATAR_IMAGES,
  MAX_AVATAR_MATERIALS,
  MAX_AVATAR_MESHES,
  MAX_AVATAR_MESH_PRIMITIVES,
  MAX_AVATAR_MODEL_BYTES,
  MAX_AVATAR_NODES,
  MAX_AVATAR_SCENES,
  MAX_AVATAR_SKINS,
  MAX_AVATAR_TEXTURES,
} from "./avatarModelLimits.ts";

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

  // Bound scene complexity independently of the 90 MB binary ceiling. Small
  // compressed files can still expand into pathological scene graphs or GPU work.
  const boundedArray = (key: string, limit: number): unknown[] => {
    const value = document[key];
    if (value === undefined) return [];
    if (!Array.isArray(value)) return reject(`gltf-${key}-invalid`);
    if (value.length > limit) return reject(`gltf-complexity-limit-${key}`);
    return value;
  };
  const nodes = boundedArray("nodes", MAX_AVATAR_NODES);
  const meshes = boundedArray("meshes", MAX_AVATAR_MESHES);
  boundedArray("materials", MAX_AVATAR_MATERIALS);
  boundedArray("textures", MAX_AVATAR_TEXTURES);
  boundedArray("images", MAX_AVATAR_IMAGES);
  boundedArray("animations", MAX_AVATAR_ANIMATIONS);
  boundedArray("skins", MAX_AVATAR_SKINS);
  boundedArray("scenes", MAX_AVATAR_SCENES);
  const buffers = boundedArray("buffers", MAX_AVATAR_BUFFERS);
  boundedArray("bufferViews", MAX_AVATAR_BUFFER_VIEWS);
  const accessors = boundedArray("accessors", MAX_AVATAR_ACCESSORS);

  let accessorElements = 0;
  for (const entry of accessors) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return reject("gltf-accessor-invalid");
    }
    const count = (entry as Record<string, unknown>).count;
    if (!Number.isSafeInteger(count) || Number(count) <= 0) {
      return reject("gltf-accessor-count-invalid");
    }
    accessorElements += Number(count);
    if (!Number.isSafeInteger(accessorElements) || accessorElements > MAX_AVATAR_ACCESSOR_ELEMENTS) {
      return reject("gltf-complexity-limit-accessors");
    }
  }

  let primitiveCount = 0;
  for (const entry of meshes) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return reject("gltf-mesh-invalid");
    }
    const primitives = (entry as Record<string, unknown>).primitives;
    if (!Array.isArray(primitives) || primitives.length === 0) {
      return reject("gltf-mesh-primitives-invalid");
    }
    primitiveCount += primitives.length;
    if (!Number.isSafeInteger(primitiveCount) || primitiveCount > MAX_AVATAR_MESH_PRIMITIVES) {
      return reject("gltf-complexity-limit-primitives");
    }
  }
  // Keep the node array bounded even though it is not needed by later checks.
  void nodes;
  let embeddedBufferSeen = false;
  for (const [index, entry] of buffers.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return reject("gltf-buffer-invalid");
    const buffer = entry as Record<string, unknown>;
    if (buffer.uri !== undefined && typeof buffer.uri !== "string") return reject("gltf-buffer-uri-invalid");
    if (typeof buffer.uri === "string" && !buffer.uri.startsWith("data:")) {
      return reject("external-buffer-uri-unsupported");
    }
    if (!Number.isSafeInteger(buffer.byteLength) || Number(buffer.byteLength) <= 0) {
      return reject("gltf-buffer-length-invalid");
    }
    if (buffer.uri === undefined) {
      // GLB 2.0 permits exactly one URI-less buffer, at index zero. Its BIN
      // chunk may contain only the up-to-three padding bytes required by GLB.
      if (index !== 0 || embeddedBufferSeen) return reject("glb-buffer-layout-invalid");
      embeddedBufferSeen = true;
      if (!hasBinaryChunk) return reject("glb-bin-chunk-missing");
      const paddingBytes = binaryChunkLength - Number(buffer.byteLength);
      if (paddingBytes < 0) return reject("glb-bin-chunk-too-small");
      if (paddingBytes > 3) return reject("glb-bin-chunk-length-mismatch");
    }
  }
  if (hasBinaryChunk && !embeddedBufferSeen) return reject("glb-bin-chunk-unreferenced");

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
