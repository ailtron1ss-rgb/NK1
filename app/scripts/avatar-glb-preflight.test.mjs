import assert from "node:assert/strict";
import test from "node:test";
import { preflightAvatarGlb } from "../src/components/avatar/avatarGlbPreflight.ts";

const u32 = (view, offset, value) => view.setUint32(offset, value, true);
function makeGlb(json, binary = null) {
  const jsonRaw = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(jsonRaw.length / 4) * 4;
  const binRaw = binary ? new Uint8Array(binary) : null;
  const binLength = binRaw ? Math.ceil(binRaw.length / 4) * 4 : 0;
  const total = 12 + 8 + jsonLength + (binRaw ? 8 + binLength : 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  u32(view, 0, 0x46546c67); u32(view, 4, 2); u32(view, 8, total);
  u32(view, 12, jsonLength); u32(view, 16, 0x4e4f534a);
  bytes.set(jsonRaw, 20); bytes.fill(0x20, 20 + jsonRaw.length, 20 + jsonLength);
  if (binRaw) {
    const head = 20 + jsonLength;
    u32(view, head, binLength); u32(view, head + 4, 0x004e4942);
    bytes.set(binRaw, head + 8);
  }
  return bytes;
}
const minimal = (extra = {}) => ({
  asset: { version: "2.0", generator: "NK1 test" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "Root" }],
  ...extra,
});

test("accepts a minimal self-contained GLB 2.0 and reports bounded import metadata", () => {
  const result = preflightAvatarGlb(makeGlb(minimal()));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.summary.nodeCount, 1);
  assert.equal(result.summary.animationCount, 0);
  assert.equal(result.summary.binaryChunkBytes, 0);
  assert.ok(result.summary.warnings.includes("glb-has-no-binary-buffer"));
});

test("rejects malformed GLB headers, declared lengths, chunk order and truncation", () => {
  const valid = makeGlb(minimal());
  const badMagic = valid.slice(); new DataView(badMagic.buffer).setUint32(0, 0, true);
  assert.equal(preflightAvatarGlb(badMagic).reason, "glb-magic-invalid");
  const badVersion = valid.slice(); new DataView(badVersion.buffer).setUint32(4, 1, true);
  assert.equal(preflightAvatarGlb(badVersion).reason, "glb-version-unsupported");
  const badLength = valid.slice(); new DataView(badLength.buffer).setUint32(8, valid.length + 4, true);
  assert.equal(preflightAvatarGlb(badLength).reason, "glb-declared-length-mismatch");
  assert.equal(preflightAvatarGlb(valid.slice(0, valid.length - 2)).reason, "glb-declared-length-mismatch");
  const wrongChunk = valid.slice(); new DataView(wrongChunk.buffer).setUint32(16, 0x004e4942, true);
  assert.equal(preflightAvatarGlb(wrongChunk).reason, "glb-json-chunk-must-be-first");
});

test("rejects external buffers and image URLs before invoking Three.js", () => {
  assert.equal(preflightAvatarGlb(makeGlb(minimal({ buffers: [{ byteLength: 4, uri: "https://evil.test/model.bin" }] }))).reason,
    "external-buffer-uri-forbidden");
  assert.equal(preflightAvatarGlb(makeGlb(minimal({ images: [{ uri: "https://evil.test/texture.png" }] }))).reason,
    "external-image-uri-forbidden");
  assert.equal(preflightAvatarGlb(makeGlb(minimal({ images: [{ uri: "file:///etc/passwd" }] }))).reason,
    "external-image-uri-forbidden");
});

test("rejects node graph cycles, shared parents, invalid scene roots and out-of-range references", () => {
  const cycle = minimal({ nodes: [{ children: [1] }, { children: [0] }], scenes: [{ nodes: [0] }] });
  assert.equal(preflightAvatarGlb(makeGlb(cycle)).reason, "gltf-node-cycle-detected");
  const sharedParent = minimal({ nodes: [{ children: [2] }, { children: [2] }, {}], scenes: [{ nodes: [0, 1] }] });
  assert.equal(preflightAvatarGlb(makeGlb(sharedParent)).reason, "gltf-node-parent-graph-invalid");
  const badScene = minimal({ scenes: [{ nodes: [3] }] });
  assert.equal(preflightAvatarGlb(makeGlb(badScene)).reason, "gltf-scene-root-invalid");
  const badMesh = minimal({ nodes: [{ mesh: 99 }], meshes: [] });
  assert.equal(preflightAvatarGlb(makeGlb(badMesh)).reason, "gltf-node-reference-invalid");
});

test("rejects bufferView, accessor, primitive and skin references outside their declared arrays", () => {
  const noBin = minimal({
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 4 }],
  });
  assert.equal(preflightAvatarGlb(makeGlb(noBin)).reason, "gltf-bin-buffer-exceeds-chunk");
  const badAccessor = minimal({ accessors: [{ count: 3, componentType: 5126, type: "VEC3", bufferView: 4 }] });
  assert.equal(preflightAvatarGlb(makeGlb(badAccessor)).reason, "gltf-accessor-buffer-view-invalid");
  const badPrimitive = minimal({ meshes: [{ primitives: [{ attributes: { POSITION: 5 } }] }], nodes: [{ mesh: 0 }] });
  assert.equal(preflightAvatarGlb(makeGlb(badPrimitive)).reason, "gltf-primitive-attribute-accessor-invalid");
  const badSkin = minimal({ skins: [{ joints: [4] }], nodes: [{ skin: 0 }] });
  assert.equal(preflightAvatarGlb(makeGlb(badSkin)).reason, "gltf-skin-joint-invalid");
});

test("rejects excessive vertices, nodes, animations and file bytes before model allocation", () => {
  const vertex = minimal({
    accessors: [{ count: 100, componentType: 5126, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
  });
  assert.equal(preflightAvatarGlb(makeGlb(vertex), { maxTotalVertices: 50 }).reason, "gltf-vertex-budget-exceeded");
  assert.equal(preflightAvatarGlb(makeGlb(minimal({ nodes: [{}, {}], scenes: [{ nodes: [0, 1] }] })), { maxNodes: 1 }).reason,
    "gltf-node-count-exceeded");
  assert.equal(preflightAvatarGlb(makeGlb(minimal({ animations: Array.from({ length: 257 }, () => ({})) }))).reason, "gltf-animation-count-exceeded");
  assert.equal(preflightAvatarGlb(makeGlb(minimal()), { maxFileBytes: 8 }).reason, "glb-file-size-exceeded");
});

test("validates embedded PNG dimensions and enforces the texture pixel budget", () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(png.buffer);
  view.setUint32(16, 64, false); view.setUint32(20, 32, false);
  const json = minimal({
    buffers: [{ byteLength: png.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: png.length }],
    images: [{ bufferView: 0, mimeType: "image/png" }],
  });
  const valid = preflightAvatarGlb(makeGlb(json, png));
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.summary.texturePixels, 2048);
  assert.equal(preflightAvatarGlb(makeGlb(json, png), { maxTexturePixels: 1024 }).reason,
    "gltf-texture-pixel-budget-exceeded");
  assert.equal(preflightAvatarGlb(makeGlb(json, png), { maxTextureDimension: 32 }).reason,
    "gltf-texture-dimension-exceeded");
});

test("rejects malformed required extension declarations and unknown root shapes", () => {
  assert.equal(preflightAvatarGlb(makeGlb({ asset: { version: "1.0" } })).reason, "gltf-asset-version-not-2.0");
  assert.equal(preflightAvatarGlb(makeGlb({ asset: { version: "2.0" }, extensionsRequired: [""] })).reason,
    "gltf-required-extension-invalid");
  assert.equal(preflightAvatarGlb(makeGlb([])).reason, "glb-json-root-not-object");
});
