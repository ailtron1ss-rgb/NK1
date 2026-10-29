export const AVATAR_GLB_LIMITS = Object.freeze({
  maxBytes: 90 * 1024 * 1024,
  maxJsonBytes: 16 * 1024 * 1024,
  maxNodes: 10_000,
  maxHierarchyDepth: 256,
  maxMeshes: 2_000,
  maxPrimitives: 5_000,
  maxAccessors: 20_000,
  maxAccessorElements: 8_000_000,
  maxImages: 256,
  maxImageBytes: 24 * 1024 * 1024,
  maxImageDimension: 8_192,
  maxImagePixels: 16_777_216,
  maxTotalImagePixels: 33_554_432,
  maxTextures: 512,
  maxMaterials: 2_000,
  maxAnimations: 200,
  maxAnimationChannels: 20_000,
});

export type AvatarModelValidationCode =
  | "file-too-large"
  | "not-glb"
  | "unsupported-glb-version"
  | "invalid-glb-length"
  | "invalid-glb-chunk"
  | "invalid-json"
  | "unsupported-gltf-version"
  | "external-resource"
  | "resource-limit"
  | "invalid-hierarchy"
  | "invalid-buffer"
  | "invalid-image"
  | "unsupported-image";

export class AvatarModelValidationError extends Error {
  readonly code: AvatarModelValidationCode;

  constructor(code: AvatarModelValidationCode, message: string) {
    super(message);
    this.name = "AvatarModelValidationError";
    this.code = code;
  }
}

export interface AvatarGlbInspection {
  byteLength: number;
  jsonByteLength: number;
  binaryByteLength: number;
  nodeCount: number;
  meshCount: number;
  primitiveCount: number;
  accessorCount: number;
  accessorElements: number;
  imageCount: number;
  imagePixels: number;
  textureCount: number;
  animationCount: number;
  animationChannelCount: number;
}

type JsonRecord = Record<string, unknown>;

function reject(code: AvatarModelValidationCode, message: string): never {
  throw new AvatarModelValidationError(code, message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayField(source: JsonRecord, key: string): unknown[] {
  const value = source[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) reject("invalid-json", `Поле ${key} в JSON-манифесте должно быть массивом.`);
  return value;
}

function boundedCount(
  value: unknown[],
  max: number,
  label: string,
): number {
  if (value.length > max) {
    reject("resource-limit", `В модели слишком много элементов «${label}»: ${value.length} при лимите ${max}.`);
  }
  return value.length;
}

function validateNodeGraph(nodes: unknown[]): void {
  if (!nodes.length) return;
  const parentCount = new Uint8Array(nodes.length);
  const children = new Array<number[]>(nodes.length);
  const depth = new Uint16Array(nodes.length);

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!isRecord(node)) reject("invalid-hierarchy", `Узел модели №${i} имеет неверный формат.`);
    const childList = arrayField(node, "children");
    const unique = new Set<number>();
    children[i] = [];

    for (const rawChild of childList) {
      if (!Number.isSafeInteger(rawChild) || (rawChild as number) < 0 || (rawChild as number) >= nodes.length) {
        reject("invalid-hierarchy", `Узел №${i} ссылается на несуществующий дочерний узел.`);
      }
      const child = rawChild as number;
      if (unique.has(child)) reject("invalid-hierarchy", `Узел №${i} содержит повторную ссылку на ребёнка №${child}.`);
      unique.add(child);
      parentCount[child] += 1;
      if (parentCount[child] > 1) reject("invalid-hierarchy", `Узел №${child} имеет более одного родителя.`);
      children[i].push(child);
    }
  }

  const queue: number[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (parentCount[i] === 0) queue.push(i);
  }

  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const parent = queue[cursor];
    visited += 1;
    for (const child of children[parent]) {
      depth[child] = depth[parent] + 1;
      if (depth[child] > AVATAR_GLB_LIMITS.maxHierarchyDepth) {
        reject("resource-limit", `Иерархия модели глубже допустимых ${AVATAR_GLB_LIMITS.maxHierarchyDepth} уровней.`);
      }
      queue.push(child);
    }
  }

  if (visited !== nodes.length) {
    reject("invalid-hierarchy", "В иерархии модели обнаружен цикл.");
  }
}

function assertNoExternalUris(items: unknown[], label: string): void {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isRecord(item) || item.uri === undefined) continue;
    if (typeof item.uri !== "string" || !item.uri.startsWith("data:") || !item.uri.includes(",")) {
      reject(
        "external-resource",
        `Ресурс ${label} №${index} ссылается наружу. Для приватной локальной загрузки используйте самодостаточный GLB без внешних URL.`,
      );
    }
  }
}

interface EmbeddedImageDimensions {
  width: number;
  height: number;
}

function decodeDataUri(uri: string, errorCode: "invalid-buffer" | "invalid-image"): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/iu.exec(uri);
  if (!match) reject(errorCode, "Поддерживаются только корректные base64 data URI для локальных ресурсов модели.");
  try {
    const decoded = atob(match[2]);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
    return { mimeType: match[1].toLowerCase(), bytes };
  } catch {
    return reject(errorCode, "Base64 data URI модели повреждён.");
  }
}

function readJpegDimensions(bytes: Uint8Array): EmbeddedImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  let scanned = 0;
  while (offset + 4 <= bytes.length && scanned < 4096) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      scanned += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (sof.has(marker)) {
      if (segmentLength < 7) break;
      const payload = offset + 2;
      return {
        height: (bytes[payload + 1] << 8) | bytes[payload + 2],
        width: (bytes[payload + 3] << 8) | bytes[payload + 4],
      };
    }
    offset += segmentLength;
    scanned += segmentLength;
  }
  return null;
}

function readEmbeddedImageDimensions(bytes: Uint8Array, mimeType: string): EmbeddedImageDimensions {
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte) ||
        bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
      reject("invalid-image", "PNG-текстура модели имеет повреждённый заголовок.");
    }
    return { width: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16, false),
      height: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20, false) };
  }
  if (mimeType === "image/jpeg") {
    const dimensions = readJpegDimensions(bytes);
    if (dimensions) return dimensions;
    reject("invalid-image", "Не удалось безопасно определить размеры JPEG-текстуры модели.");
  }
  reject("unsupported-image", `Неподдерживаемый формат встроенной текстуры: ${mimeType || "не указан"}. Используйте PNG или JPEG.`);
}

function assertSafeImageDimensions(dimensions: EmbeddedImageDimensions, index: number): number {
  const { width, height } = dimensions;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    reject("invalid-image", `Изображение модели №${index} имеет нулевые или некорректные размеры.`);
  }
  const pixels = width * height;
  if (width > AVATAR_GLB_LIMITS.maxImageDimension || height > AVATAR_GLB_LIMITS.maxImageDimension ||
      pixels > AVATAR_GLB_LIMITS.maxImagePixels) {
    reject("resource-limit", `Текстура №${index} превышает допустимый предел ${AVATAR_GLB_LIMITS.maxImageDimension}px или ${AVATAR_GLB_LIMITS.maxImagePixels.toLocaleString("en-US")} пикселей.`);
  }
  return pixels;
}

/**
 * Validates the GLB container and its resource manifest before GLTFLoader sees
 * user-supplied bytes. The app only supports self-contained binary VRM/GLB:
 * external image/buffer URLs are rejected so importing a model cannot trigger
 * implicit network requests. This is a preflight guard, not a substitute for
 * rendering in a real browser or for the GLTF parser's own validation.
 */
export function inspectSelfContainedGlb(
  input: ArrayBuffer | Uint8Array,
  maxBytes = AVATAR_GLB_LIMITS.maxBytes,
): AvatarGlbInspection {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > maxBytes) {
    reject("file-too-large", `Файл модели превышает лимит ${Math.floor(maxBytes / (1024 * 1024))} МиБ.`);
  }
  if (bytes.byteLength < 20) reject("not-glb", "Файл слишком короткий и не является бинарной моделью GLB/VRM.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) reject("not-glb", "Ожидался бинарный GLB/VRM (сигнатура glTF).");

  const version = view.getUint32(4, true);
  if (version !== 2) reject("unsupported-glb-version", `Поддерживается GLB 2.0; получена версия ${version}.`);
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.byteLength) {
    reject("invalid-glb-length", "Размер GLB в заголовке не совпадает с фактическим размером файла.");
  }

  let offset = 12;
  let jsonText: string | null = null;
  let jsonByteLength = 0;
  let binaryByteLength = 0;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) reject("invalid-glb-chunk", "Обрезан заголовок блока GLB.");
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkLength % 4 !== 0 || chunkEnd > bytes.byteLength || chunkEnd < chunkStart) {
      reject("invalid-glb-chunk", "Длина или границы блока GLB некорректны.");
    }

    if (chunkIndex === 0 && chunkType !== 0x4e4f534a) {
      reject("invalid-glb-chunk", "Первым блоком GLB должен быть JSON.");
    }
    if (chunkType === 0x4e4f534a) {
      if (jsonText !== null) reject("invalid-glb-chunk", "GLB содержит больше одного JSON-блока.");
      if (chunkLength > AVATAR_GLB_LIMITS.maxJsonBytes) {
        reject("resource-limit", "JSON-манифест модели превышает " + (AVATAR_GLB_LIMITS.maxJsonBytes / (1024 * 1024)) + " МиБ.");
      }
      try {
        jsonText = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(chunkStart, chunkEnd)).trimEnd();
      } catch {
        reject("invalid-json", "JSON-блок модели не является корректным UTF-8.");
      }
      jsonByteLength = chunkLength;
    } else if (chunkType === 0x004e4942) {
      if (binaryByteLength !== 0) reject("invalid-glb-chunk", "GLB содержит больше одного BIN-блока.");
      binaryByteLength = chunkLength;
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (offset !== bytes.byteLength || jsonText === null) {
    reject("invalid-glb-chunk", "GLB должен содержать один корректный JSON-блок.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    reject("invalid-json", "JSON-манифест модели повреждён.");
  }
  if (!isRecord(parsed) || !isRecord(parsed.asset) || parsed.asset.version !== "2.0") {
    reject("unsupported-gltf-version", "Поддерживаются только модели glTF/GLB 2.0.");
  }

  const buffers = arrayField(parsed, "buffers");
  const images = arrayField(parsed, "images");
  assertNoExternalUris(buffers, "buffer");
  assertNoExternalUris(images, "image");

  for (let i = 0; i < buffers.length; i += 1) {
    const buffer = buffers[i];
    if (!isRecord(buffer) || !Number.isSafeInteger(buffer.byteLength) || (buffer.byteLength as number) < 0) {
      reject("invalid-buffer", `Описание buffer №${i} некорректно.`);
    }
    if (buffer.uri === undefined) {
      if (i !== 0) reject("invalid-buffer", "Только первый buffer GLB может использовать встроенный BIN-блок.");
      if ((buffer.byteLength as number) > binaryByteLength) {
        reject("invalid-buffer", "BIN-блок короче, чем указано в JSON-манифесте модели.");
      }
    }
  }

  const nodes = arrayField(parsed, "nodes");
  const meshes = arrayField(parsed, "meshes");
  const accessors = arrayField(parsed, "accessors");
  const textures = arrayField(parsed, "textures");
  const materials = arrayField(parsed, "materials");
  const animations = arrayField(parsed, "animations");
  const nodeCount = boundedCount(nodes, AVATAR_GLB_LIMITS.maxNodes, "nodes");
  const meshCount = boundedCount(meshes, AVATAR_GLB_LIMITS.maxMeshes, "meshes");
  const accessorCount = boundedCount(accessors, AVATAR_GLB_LIMITS.maxAccessors, "accessors");
  const imageCount = boundedCount(images, AVATAR_GLB_LIMITS.maxImages, "images");
  const textureCount = boundedCount(textures, AVATAR_GLB_LIMITS.maxTextures, "textures");
  boundedCount(materials, AVATAR_GLB_LIMITS.maxMaterials, "materials");
  const animationCount = boundedCount(animations, AVATAR_GLB_LIMITS.maxAnimations, "animations");

  let primitiveCount = 0;
  for (const mesh of meshes) {
    if (!isRecord(mesh)) reject("resource-limit", "Обнаружена запись mesh неверного формата.");
    primitiveCount += arrayField(mesh, "primitives").length;
    if (primitiveCount > AVATAR_GLB_LIMITS.maxPrimitives) {
      reject("resource-limit", `В модели больше ${AVATAR_GLB_LIMITS.maxPrimitives} mesh primitives.`);
    }
  }

  let accessorElements = 0;
  for (let i = 0; i < accessors.length; i += 1) {
    const accessor = accessors[i];
    if (!isRecord(accessor) || !Number.isSafeInteger(accessor.count) || (accessor.count as number) < 0) {
      reject("resource-limit", `Accessor №${i} имеет некорректный count.`);
    }
    accessorElements += accessor.count as number;
    if (accessorElements > AVATAR_GLB_LIMITS.maxAccessorElements) {
      reject("resource-limit", `Суммарный размер accessors превышает лимит ${AVATAR_GLB_LIMITS.maxAccessorElements.toLocaleString("en-US")} элементов.`);
    }
  }

  let animationChannelCount = 0;
  for (const animation of animations) {
    if (!isRecord(animation)) reject("resource-limit", "Обнаружена запись animation неверного формата.");
    animationChannelCount += arrayField(animation, "channels").length;
    if (animationChannelCount > AVATAR_GLB_LIMITS.maxAnimationChannels) {
      reject("resource-limit", "В модели слишком много анимационных каналов.");
    }
  }

  validateNodeGraph(nodes);
  const bufferViews = arrayField(parsed, "bufferViews");
  for (let i = 0; i < bufferViews.length; i += 1) {
    const bufferView = bufferViews[i];
    if (!isRecord(bufferView) || !Number.isSafeInteger(bufferView.buffer) ||
        (bufferView.buffer as number) < 0 || (bufferView.buffer as number) >= buffers.length ||
        !Number.isSafeInteger(bufferView.byteLength) || (bufferView.byteLength as number) < 0 ||
        (bufferView.byteOffset !== undefined && (!Number.isSafeInteger(bufferView.byteOffset) || (bufferView.byteOffset as number) < 0))) {
      reject("invalid-buffer", `bufferView №${i} ссылается на некорректный buffer, byteOffset или byteLength.`);
    }
    const backingBuffer = buffers[bufferView.buffer as number];
    if (!isRecord(backingBuffer)) reject("invalid-buffer", `bufferView №${i} ссылается на некорректный buffer.`);
    const byteOffset = (bufferView.byteOffset ?? 0) as number;
    if (byteOffset + (bufferView.byteLength as number) > (backingBuffer.byteLength as number)) {
      reject("invalid-buffer", `bufferView №${i} выходит за границы объявленного buffer.`);
    }
  }
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (!isRecord(image)) reject("invalid-buffer", `image №${i} имеет некорректный формат.`);
    if (image.bufferView !== undefined &&
        (!Number.isSafeInteger(image.bufferView) || (image.bufferView as number) < 0 || (image.bufferView as number) >= bufferViews.length)) {
      reject("invalid-buffer", `image №${i} ссылается на несуществующий bufferView.`);
    }
  }

  return {
    byteLength: bytes.byteLength,
    jsonByteLength,
    binaryByteLength,
    nodeCount,
    meshCount,
    primitiveCount,
    accessorCount,
    accessorElements,
    imageCount,
    textureCount,
    animationCount,
    animationChannelCount,
  };
}
