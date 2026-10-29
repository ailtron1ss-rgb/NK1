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
