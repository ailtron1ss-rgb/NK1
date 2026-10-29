import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_GLB_LIMITS,
  AvatarModelValidationError,
  inspectSelfContainedGlb,
} from "../src/components/avatar/avatarModelValidation.ts";

const encoder = new TextEncoder();

function makeGlb(json, bin = [1, 2, 3, 4]) {
  return makeGlbText(JSON.stringify(json), bin);
}

function makeGlbText(jsonText, bin = [1, 2, 3, 4]) {
  const jsonBytes = encoder.encode(jsonText);
  const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const jsonChunk = new Uint8Array(paddedJsonLength);
  jsonChunk.fill(0x20);
  jsonChunk.set(jsonBytes);

  const binBytes = bin === null ? null : Uint8Array.from(bin);
  const paddedBinLength = binBytes ? Math.ceil(binBytes.length / 4) * 4 : 0;
  const totalLength = 12 + 8 + jsonChunk.length + (binBytes ? 8 + paddedBinLength : 0);
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(jsonChunk, 20);
  if (binBytes) {
    const binHeader = 20 + jsonChunk.length;
    view.setUint32(binHeader, paddedBinLength, true);
    view.setUint32(binHeader + 4, 0x004e4942, true);
    output.set(binBytes, binHeader + 8);
  }
  return output;
}

function minimalJson(overrides = {}) {
  return {
    asset: { version: "2.0", generator: "NK1 test fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{}],
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: "SCALAR" }],
    ...overrides,
  };
}

function pngHeader(width, height) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[24] = 8;
  bytes[25] = 6;
  return Array.from(bytes);
}

function jpegHeader(width, height) {
  return [
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ];
}

function textureGlb(imagesToCreate) {
  const bin = [1, 2, 3, 4];
  const bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 4 }];
  const images = [];
  for (const image of imagesToCreate) {
    const offset = bin.length;
    const imageBytes = image.format === "jpeg" ? jpegHeader(image.width, image.height) : pngHeader(image.width, image.height);
    bin.push(...imageBytes);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: imageBytes.length });
    images.push({ bufferView: bufferViews.length - 1, mimeType: image.format === "jpeg" ? "image/jpeg" : "image/png" });
  }
  const json = minimalJson({
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    images,
  });
  return makeGlb(json, bin);
}

function expectCode(bytes, code, options) {
  assert.throws(
    () => inspectSelfContainedGlb(bytes, options?.maxBytes),
    (error) => error instanceof AvatarModelValidationError && error.code === code,
  );
}

test("accepts a self-contained GLB 2.0 and reports a compact resource summary", () => {
  const bytes = makeGlb(minimalJson());
  const result = inspectSelfContainedGlb(bytes);
  assert.equal(result.byteLength, bytes.byteLength);
  assert.equal(result.nodeCount, 1);
  assert.equal(result.meshCount, 0);
  assert.equal(result.accessorCount, 1);
  assert.equal(result.accessorElements, 1);
  assert.equal(result.binaryByteLength, 4);
});

test("rejects oversized files before parsing", () => {
  expectCode(makeGlb(minimalJson()), "file-too-large", { maxBytes: 24 });
});

test("rejects wrong magic, unsupported GLB versions, and mismatched declared length", () => {
  const wrongMagic = makeGlb(minimalJson());
  new DataView(wrongMagic.buffer).setUint32(0, 0x12345678, true);
  expectCode(wrongMagic, "not-glb");

  const wrongVersion = makeGlb(minimalJson());
  new DataView(wrongVersion.buffer).setUint32(4, 1, true);
  expectCode(wrongVersion, "unsupported-glb-version");

  const wrongLength = makeGlb(minimalJson());
  new DataView(wrongLength.buffer).setUint32(8, wrongLength.byteLength - 4, true);
  expectCode(wrongLength, "invalid-glb-length");
});

test("rejects malformed JSON and broken chunk boundaries", () => {
  expectCode(makeGlbText("{not-json"), "invalid-json");
  const bytes = makeGlb(minimalJson());
  new DataView(bytes.buffer).setUint32(12, 0xfffffff0, true);
  expectCode(bytes, "invalid-glb-chunk");
});

test("rejects network-backed resources instead of allowing implicit fetches", () => {
  expectCode(makeGlb(minimalJson({
    buffers: [{ byteLength: 4, uri: "https://example.invalid/mesh.bin" }],
  })), "external-resource");

  expectCode(makeGlb(minimalJson({
    images: [{ uri: "https://example.invalid/texture.png" }],
  })), "external-resource");

  const embedded = minimalJson({
    buffers: [{ byteLength: 4, uri: "data:application/octet-stream;base64,AQIDBA==" }],
  });
  assert.equal(inspectSelfContainedGlb(makeGlb(embedded, null)).nodeCount, 1);
});

test("sniffs PNG/JPEG dimensions and accepts a bounded 4K texture", () => {
  const png = inspectSelfContainedGlb(textureGlb([{ width: 4096, height: 4096 }]));
  assert.equal(png.imagePixels, 4096 * 4096);
  const jpeg = inspectSelfContainedGlb(textureGlb([{ width: 320, height: 240, format: "jpeg" }]));
  assert.equal(jpeg.imagePixels, 320 * 240);
});

test("rejects pathological texture dimensions and excessive total decoded pixels", () => {
  expectCode(textureGlb([{ width: 16384, height: 1 }]), "resource-limit");
  expectCode(textureGlb([{ width: 0, height: 1024 }]), "invalid-image");
  expectCode(textureGlb([
    { width: 4096, height: 4096 },
    { width: 4096, height: 4096 },
    { width: 4096, height: 4096 },
  ]), "resource-limit");
});

test("validates data-URI image headers before texture decode", () => {
  const bytes = Uint8Array.from(pngHeader(64, 32));
  const uri = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  const glb = makeGlb(minimalJson({ images: [{ uri }] }));
  const result = inspectSelfContainedGlb(glb);
  assert.equal(result.imagePixels, 64 * 32);
  expectCode(makeGlb(minimalJson({ images: [{ uri: "data:image/svg+xml;base64,PHN2Zy8+" }] })), "unsupported-image");
});

test("rejects malformed buffer declarations instead of trusting the extension", () => {
  expectCode(makeGlb(minimalJson({ buffers: [{ byteLength: 400 }] })), "invalid-buffer");
  expectCode(makeGlb(minimalJson({ images: { uri: "data:image/png;base64,AA==" } })), "invalid-json");
  expectCode(makeGlb(minimalJson({
    bufferViews: [{ buffer: 5, byteOffset: 0, byteLength: 4 }],
  })), "invalid-buffer");
  expectCode(makeGlb(minimalJson({
    images: [{ bufferView: 8, mimeType: "image/png" }],
  })), "invalid-buffer");
  expectCode(makeGlb(minimalJson({
    bufferViews: [{ buffer: 0, byteOffset: 3, byteLength: 4 }],
  })), "invalid-buffer");
});

test("bounds scene complexity before the renderer allocates geometry", () => {
  const tooManyNodes = Array.from({ length: AVATAR_GLB_LIMITS.maxNodes + 1 }, () => ({}));
  expectCode(makeGlb(minimalJson({ nodes: tooManyNodes, scenes: [{ nodes: [] }] })), "resource-limit");

  expectCode(makeGlb(minimalJson({
    accessors: [{ count: AVATAR_GLB_LIMITS.maxAccessorElements + 1 }],
  })), "resource-limit");

  const tooManyMeshes = Array.from({ length: AVATAR_GLB_LIMITS.maxMeshes + 1 }, () => ({ primitives: [] }));
  expectCode(makeGlb(minimalJson({ meshes: tooManyMeshes })), "resource-limit");
});

test("rejects hierarchy cycles, multiply-parented nodes, and pathological depth", () => {
  expectCode(makeGlb(minimalJson({
    nodes: [{ children: [1] }, { children: [0] }],
    scenes: [{ nodes: [0] }],
  })), "invalid-hierarchy");

  expectCode(makeGlb(minimalJson({
    nodes: [{ children: [2] }, { children: [2] }, {}],
    scenes: [{ nodes: [0, 1] }],
  })), "invalid-hierarchy");

  const nodes = Array.from({ length: AVATAR_GLB_LIMITS.maxHierarchyDepth + 2 }, (_, index) =>
    index === AVATAR_GLB_LIMITS.maxHierarchyDepth + 1 ? {} : { children: [index + 1] });
  expectCode(makeGlb(minimalJson({ nodes, scenes: [{ nodes: [0] }] })), "resource-limit");
});

test("counts mesh primitives and animation channels", () => {
  const valid = minimalJson({
    meshes: [{ primitives: [{ attributes: {} }, { attributes: {} }] }],
    animations: [{ channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }] }],
  });
  const inspected = inspectSelfContainedGlb(makeGlb(valid));
  assert.equal(inspected.meshCount, 1);
  assert.equal(inspected.primitiveCount, 2);
  assert.equal(inspected.animationCount, 1);
  assert.equal(inspected.animationChannelCount, 1);
});
