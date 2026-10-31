export interface AvatarGlbPreflightLimits {
  maxFileBytes: number;
  maxNodes: number;
  maxMeshes: number;
  maxPrimitives: number;
  maxBufferViews: number;
  maxAccessors: number;
  maxAccessorElements: number;
  maxTotalVertices: number;
  maxAnimations: number;
  maxAnimationChannels: number;
  maxImages: number;
  maxTextureDimension: number;
  maxTexturePixels: number;
}
export const DEFAULT_AVATAR_GLB_PREFLIGHT_LIMITS: Readonly<AvatarGlbPreflightLimits> = Object.freeze({
  maxFileBytes: 90 * 1024 * 1024,
  maxNodes: 8192,
  maxMeshes: 2048,
  maxPrimitives: 8192,
  maxBufferViews: 8192,
  maxAccessors: 16384,
  maxAccessorElements: 20_000_000,
  maxTotalVertices: 12_000_000,
  maxAnimations: 256,
  maxAnimationChannels: 16_384,
  maxImages: 512,
  maxTextureDimension: 8192,
  maxTexturePixels: 96_000_000,
});
export interface AvatarGlbPreflightSummary {
  byteLength: number;
  jsonChunkBytes: number;
  binaryChunkBytes: number;
  nodeCount: number;
  meshCount: number;
  primitiveCount: number;
  accessorCount: number;
  accessorElements: number;
  estimatedVertexCount: number;
  animationCount: number;
  animationChannelCount: number;
  imageCount: number;
  texturePixels: number;
  extensionsRequired: string[];
  warnings: string[];
}
export type AvatarGlbPreflightResult =
  | { ok: true; summary: AvatarGlbPreflightSummary }
  | { ok: false; reason: string; detail?: string };

type RecordValue = Record<string, unknown>;
const isRecord = (v: unknown): v is RecordValue => v !== null && typeof v === "object" && !Array.isArray(v);
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const isIndex = (v: unknown, length: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) < length;
const isUInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const fail = (reason: string, detail?: string): AvatarGlbPreflightResult =>
  ({ ok: false, reason, ...(detail ? { detail: detail.slice(0, 240) } : {}) });

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const ACCESSOR_WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}
function parseGlbChunks(bytes: Uint8Array): { json: RecordValue; jsonBytes: number; bin: Uint8Array } | AvatarGlbPreflightResult {
  if (bytes.byteLength < 20) return fail("glb-too-small");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readU32(view, 0) !== GLB_MAGIC) return fail("glb-magic-invalid");
  if (readU32(view, 4) !== 2) return fail("glb-version-unsupported");
  if (readU32(view, 8) !== bytes.byteLength) return fail("glb-declared-length-mismatch");
  let offset = 12;
  let json: RecordValue | null = null;
  let jsonBytes = 0;
  let bin: Uint8Array = new Uint8Array(0);
  let sawBin = false;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) return fail("glb-chunk-header-truncated");
    const chunkLength = readU32(view, offset);
    const chunkType = readU32(view, offset + 4);
    offset += 8;
    if (chunkLength === 0 || chunkLength % 4 !== 0 || offset + chunkLength > bytes.byteLength) {
      return fail("glb-chunk-length-invalid");
    }
    const chunk = bytes.subarray(offset, offset + chunkLength);
    if (json === null) {
      if (chunkType !== JSON_CHUNK) return fail("glb-json-chunk-must-be-first");
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(chunk).replace(/[ \\t\\r\\n]+$/u, "");
        const parsed: unknown = JSON.parse(text);
        if (!isRecord(parsed)) return fail("glb-json-root-not-object");
        json = parsed;
        jsonBytes = chunkLength;
      } catch {
        return fail("glb-json-invalid");
      }
    } else if (chunkType === JSON_CHUNK) {
      return fail("glb-duplicate-json-chunk");
    } else if (chunkType === BIN_CHUNK) {
      if (sawBin) return fail("glb-duplicate-bin-chunk");
      sawBin = true;
      bin = chunk;
    }
    offset += chunkLength;
  }
  if (!json) return fail("glb-json-chunk-missing");
  return { json, jsonBytes, bin };
}

function validateImageBytes(data: Uint8Array): { width: number; height: number } | null {
  if (data.byteLength >= 24 && PNG_SIGNATURE.every((byte, i) => data[i] === byte)
    && data[12] === 0x49 && data[13] === 0x48 && data[14] === 0x44 && data[15] === 0x52) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }
  if (data.byteLength >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= data.byteLength) {
      if (data[offset] !== 0xff) { offset++; continue; }
      const marker = data[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.byteLength) break;
      const size = (data[offset] << 8) | data[offset + 1];
      if (size < 2 || offset + size > data.byteLength) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 7) break;
        return { height: (data[offset + 3] << 8) | data[offset + 4], width: (data[offset + 5] << 8) | data[offset + 6] };
      }
      offset += size;
    }
  }
  return null;
}

function decodeDataImage(uri: string): Uint8Array | null {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const header = uri.slice(0, comma).toLowerCase();
  if (header !== "data:image/png;base64" && header !== "data:image/jpeg;base64") return null;
  const payload = uri.slice(comma + 1);
  if (!payload.length || payload.length > 64 * 1024 * 1024 || payload.length % 4 !== 0) return null;
  let paddingStarted = false;
  let paddingCount = 0;
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    if (code === 61) {
      paddingStarted = true;
      paddingCount++;
      if (paddingCount > 2 || i < payload.length - 2) return null;
      continue;
    }
    if (paddingStarted) return null;
    const allowed = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57) || code === 43 || code === 47;
    if (!allowed) return null;
  }
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Fail-closed GLB 2.0 preflight for local VRM/GLB uploads.
 * It is a resource/security gate, not a substitute for the Khronos validator,
 * VRM semantic validation, artist review or exact per-model calibration.
 */
export function preflightAvatarGlb(
  input: ArrayBuffer | Uint8Array,
  limits: Partial<AvatarGlbPreflightLimits> = {},
): AvatarGlbPreflightResult {
  const policy = { ...DEFAULT_AVATAR_GLB_PREFLIGHT_LIMITS, ...limits };
  if (!Object.values(policy).every((value) => Number.isSafeInteger(value) && value > 0)) return fail("preflight-limits-invalid");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > policy.maxFileBytes) return fail("glb-file-size-exceeded");
  const parsed = parseGlbChunks(bytes);
  if ("ok" in parsed && parsed.ok === false) return parsed;
  const { json, jsonBytes, bin } = parsed as { json: RecordValue; jsonBytes: number; bin: Uint8Array };
  const asset = json.asset;
  if (!isRecord(asset) || asset.version !== "2.0") return fail("gltf-asset-version-not-2.0");
  if (asset.minVersion !== undefined && asset.minVersion !== "2.0") return fail("gltf-min-version-unsupported");
  const buffers = array(json.buffers);
  if (buffers.length > 1) return fail("glb-buffer-count-exceeded");
  let declaredBufferBytes = 0;
  if (buffers.length) {
    const buffer = buffers[0];
    if (!isRecord(buffer) || !isUInt(buffer.byteLength)) return fail("gltf-buffer-invalid");
    if (typeof buffer.uri === "string") return fail("external-buffer-uri-forbidden");
    declaredBufferBytes = buffer.byteLength;
    if (declaredBufferBytes > bin.byteLength || declaredBufferBytes > policy.maxFileBytes) return fail("gltf-bin-buffer-exceeds-chunk");
  } else if (bin.byteLength > 0) {
    return fail("glb-bin-without-buffer-definition");
  }

  const views = array(json.bufferViews);
  if (views.length > policy.maxBufferViews) return fail("gltf-buffer-view-count-exceeded");
  const normalizedViews: Array<{ offset: number; length: number }> = [];
  for (const raw of views) {
    if (!isRecord(raw) || raw.buffer !== 0 || !isUInt(raw.byteLength)) return fail("gltf-buffer-view-invalid");
    const offset = raw.byteOffset === undefined ? 0 : raw.byteOffset;
    if (!isUInt(offset) || offset + raw.byteLength > declaredBufferBytes) return fail("gltf-buffer-view-out-of-range");
    if (raw.byteStride !== undefined && (!isUInt(raw.byteStride) || raw.byteStride < 4 || raw.byteStride > 252 || raw.byteStride % 4 !== 0)) {
      return fail("gltf-buffer-view-stride-invalid");
    }
    normalizedViews.push({ offset, length: raw.byteLength });
  }

  const accessors = array(json.accessors);
  if (accessors.length > policy.maxAccessors) return fail("gltf-accessor-count-exceeded");
  let accessorElements = 0;
  const accessorCounts: number[] = [];
  for (const raw of accessors) {
    if (!isRecord(raw) || !isUInt(raw.count) || raw.count > policy.maxAccessorElements
      || !isUInt(raw.componentType) || !(raw.componentType in COMPONENT_BYTES)
      || typeof raw.type !== "string" || !(raw.type in ACCESSOR_WIDTH)) return fail("gltf-accessor-invalid");
    if (raw.bufferView !== undefined && !isIndex(raw.bufferView, views.length)) return fail("gltf-accessor-buffer-view-invalid");
    if (raw.sparse !== undefined) {
      if (!isRecord(raw.sparse) || !isUInt(raw.sparse.count) || raw.sparse.count > raw.count
        || !isRecord(raw.sparse.indices) || !isIndex(raw.sparse.indices.bufferView, views.length)
        || !isUInt(raw.sparse.indices.componentType) || ![5121, 5123, 5125].includes(raw.sparse.indices.componentType as number)
        || !isRecord(raw.sparse.values) || !isIndex(raw.sparse.values.bufferView, views.length)) return fail("gltf-accessor-sparse-invalid");
    }
    accessorCounts.push(raw.count);
    accessorElements += raw.count;
    if (accessorElements > policy.maxAccessorElements) return fail("gltf-accessor-element-budget-exceeded");
  }

  const nodes = array(json.nodes);
  if (nodes.length > policy.maxNodes) return fail("gltf-node-count-exceeded");
  const parents = new Int32Array(nodes.length);
  parents.fill(-1);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!isRecord(node)) return fail("gltf-node-invalid");
    for (const [field, collection] of [["mesh", array(json.meshes)], ["skin", array(json.skins)], ["camera", array(json.cameras)]] as const) {
      if (node[field] !== undefined && !isIndex(node[field], collection.length)) return fail("gltf-node-reference-invalid", field);
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || node.children.length > nodes.length) return fail("gltf-node-children-invalid");
      const childSet = new Set<number>();
      for (const child of node.children) {
        if (!isIndex(child, nodes.length) || childSet.has(child) || child === i || parents[child] !== -1) return fail("gltf-node-parent-graph-invalid");
        childSet.add(child);
        parents[child] = i;
      }
    }
  }
  const visit = new Uint8Array(nodes.length);
  const walk = (index: number): boolean => {
    if (visit[index] === 1) return false;
    if (visit[index] === 2) return true;
    visit[index] = 1;
    for (const child of array((nodes[index] as RecordValue).children)) {
      if (!isIndex(child, nodes.length) || !walk(child)) return false;
    }
    visit[index] = 2;
    return true;
  };
  for (let i = 0; i < nodes.length; i++) if (!walk(i)) return fail("gltf-node-cycle-detected");
  const scenes = array(json.scenes);
  if (json.scene !== undefined && !isIndex(json.scene, scenes.length)) return fail("gltf-default-scene-invalid");
  for (const raw of scenes) {
    if (!isRecord(raw) || !Array.isArray(raw.nodes)) return fail("gltf-scene-invalid");
    for (const root of raw.nodes) if (!isIndex(root, nodes.length) || parents[root] !== -1) return fail("gltf-scene-root-invalid");
  }

  const meshes = array(json.meshes);
  if (meshes.length > policy.maxMeshes) return fail("gltf-mesh-count-exceeded");
  let primitiveCount = 0;
  let estimatedVertexCount = 0;
  for (const mesh of meshes) {
    if (!isRecord(mesh) || !Array.isArray(mesh.primitives) || mesh.primitives.length === 0) return fail("gltf-mesh-invalid");
    primitiveCount += mesh.primitives.length;
    if (primitiveCount > policy.maxPrimitives) return fail("gltf-primitive-count-exceeded");
    for (const primitive of mesh.primitives) {
      if (!isRecord(primitive) || !isRecord(primitive.attributes)) return fail("gltf-primitive-invalid");
      if (primitive.indices !== undefined && (!isIndex(primitive.indices, accessors.length)
        || (accessors[primitive.indices] as RecordValue).type !== "SCALAR")) return fail("gltf-primitive-index-accessor-invalid");
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
        if (!isIndex(accessorIndex, accessors.length)) return fail("gltf-primitive-attribute-accessor-invalid", semantic);
        if (semantic === "POSITION") estimatedVertexCount += accessorCounts[accessorIndex];
      }
      if (primitive.material !== undefined && !isIndex(primitive.material, array(json.materials).length)) return fail("gltf-primitive-material-invalid");
      if (primitive.mode !== undefined && (!isUInt(primitive.mode) || primitive.mode > 6)) return fail("gltf-primitive-mode-invalid");
    }
  }
  if (estimatedVertexCount > policy.maxTotalVertices) return fail("gltf-vertex-budget-exceeded");

  const skins = array(json.skins);
  for (const raw of skins) {
    if (!isRecord(raw) || !Array.isArray(raw.joints) || raw.joints.length < 1 || raw.joints.length > nodes.length) return fail("gltf-skin-invalid");
    for (const joint of raw.joints) if (!isIndex(joint, nodes.length)) return fail("gltf-skin-joint-invalid");
    if (raw.skeleton !== undefined && !isIndex(raw.skeleton, nodes.length)) return fail("gltf-skin-skeleton-invalid");
    if (raw.inverseBindMatrices !== undefined && (!isIndex(raw.inverseBindMatrices, accessors.length)
      || (accessors[raw.inverseBindMatrices] as RecordValue).type !== "MAT4")) return fail("gltf-skin-inverse-bind-accessor-invalid");
  }

  const animations = array(json.animations);
  if (animations.length > policy.maxAnimations) return fail("gltf-animation-count-exceeded");
  let animationChannelCount = 0;
  for (const animation of animations) {
    if (!isRecord(animation)) return fail("gltf-animation-invalid");
    const samplers = array(animation.samplers);
    const channels = array(animation.channels);
    animationChannelCount += channels.length;
    if (samplers.length > 4096 || animationChannelCount > policy.maxAnimationChannels) return fail("gltf-animation-budget-exceeded");
    for (const sampler of samplers) {
      if (!isRecord(sampler) || !isIndex(sampler.input, accessors.length) || !isIndex(sampler.output, accessors.length)
        || (sampler.interpolation !== undefined && !["LINEAR", "STEP", "CUBICSPLINE"].includes(String(sampler.interpolation)))) {
        return fail("gltf-animation-sampler-invalid");
      }
    }
    for (const channel of channels) {
      if (!isRecord(channel) || !isIndex(channel.sampler, samplers.length) || !isRecord(channel.target)
        || !isIndex(channel.target.node, nodes.length)
        || !["translation", "rotation", "scale", "weights"].includes(String(channel.target.path))) return fail("gltf-animation-channel-invalid");
    }
  }

  const images = array(json.images);
  if (images.length > policy.maxImages) return fail("gltf-image-count-exceeded");
  let texturePixels = 0;
  for (const image of images) {
    if (!isRecord(image)) return fail("gltf-image-invalid");
    let imageBytes: Uint8Array | null = null;
    if (typeof image.uri === "string") {
      if (!image.uri.startsWith("data:")) return fail("external-image-uri-forbidden");
      imageBytes = decodeDataImage(image.uri);
      if (!imageBytes) return fail("embedded-image-data-uri-invalid");
    } else if (isIndex(image.bufferView, views.length)) {
      if (typeof image.mimeType !== "string" || !["image/png", "image/jpeg"].includes(image.mimeType)) return fail("gltf-image-mime-type-unsupported");
      const view = normalizedViews[image.bufferView];
      imageBytes = bin.subarray(view.offset, view.offset + view.length);
    } else {
      return fail("gltf-image-source-missing");
    }
    const dimensions = validateImageBytes(imageBytes);
    if (!dimensions || !isUInt(dimensions.width) || !isUInt(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
      return fail("gltf-image-header-invalid");
    }
    if (dimensions.width > policy.maxTextureDimension || dimensions.height > policy.maxTextureDimension) return fail("gltf-texture-dimension-exceeded");
    texturePixels += dimensions.width * dimensions.height;
    if (texturePixels > policy.maxTexturePixels) return fail("gltf-texture-pixel-budget-exceeded");
  }

  const extensionsRequired = array(json.extensionsRequired);
  if (extensionsRequired.some((v) => typeof v !== "string" || !v.trim() || v.length > 128)) return fail("gltf-required-extension-invalid");
  const warnings: string[] = [];
  if (!buffers.length) warnings.push("glb-has-no-binary-buffer");
  if (nodes.length === 0) warnings.push("gltf-has-no-nodes");
  const summary: AvatarGlbPreflightSummary = {
    byteLength: bytes.byteLength,
    jsonChunkBytes: jsonBytes,
    binaryChunkBytes: bin.byteLength,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    primitiveCount,
    accessorCount: accessors.length,
    accessorElements,
    estimatedVertexCount,
    animationCount: animations.length,
    animationChannelCount,
    imageCount: images.length,
    texturePixels,
    extensionsRequired: extensionsRequired as string[],
    warnings,
  };
  return { ok: true, summary };
}
