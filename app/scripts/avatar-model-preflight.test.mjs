import assert from "node:assert/strict";
import test from "node:test";
import { MAX_AVATAR_MODEL_BYTES, preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
function glb(document, binary = new Uint8Array([1, 2, 3, 4])) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binLength = Math.ceil(binary.length / 4) * 4;
  const total = 12 + 8 + jsonLength + (binary.length ? 8 + binLength : 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(json, 20);
  if (binary.length) {
    const offset = 20 + jsonLength;
    view.setUint32(offset, binLength, true);
    view.setUint32(offset + 4, BIN_CHUNK, true);
    bytes.set(binary, offset + 8);
  }
  return bytes;
}
const baseDocument = () => ({ asset: { version: "2.0", generator: "NK1 test" }, buffers: [{ byteLength: 4 }] });

test("accepts a structurally valid self-contained generic GLB", () => {
  const result = preflightAvatarModel(glb(baseDocument()), "kurisu.glb");
  assert.equal(result.format, "glb");
  assert.equal(result.byteLength > 0, true);
  assert.equal(result.hasBinaryChunk, true);
  assert.deepEqual(result.extensionsUsed, []);
});

test("recognizes VRM 1.0 and VRM 0.x without rewriting the source document", () => {
  const v1 = glb({ ...baseDocument(), extensionsUsed: ["VRMC_vrm"] });
  const v0 = glb({ ...baseDocument(), extensionsUsed: ["VRM"] });
  assert.equal(preflightAvatarModel(v1, "kurisu.glb").format, "vrm");
  assert.equal(preflightAvatarModel(v0, "kurisu.vrm").format, "vrm");
});

test("rejects a .vrm filename whose GLB has no VRM extension", () => {
  assert.throws(() => preflightAvatarModel(glb(baseDocument()), "not-a-vrm.vrm"), /vrm-extension-missing/);
});

test("rejects wrong magic, unsupported version and mismatched total length", () => {
  const wrongMagic = glb(baseDocument()); wrongMagic[0] = 0;
  assert.throws(() => preflightAvatarModel(wrongMagic, "bad.glb"), /glb-magic-invalid/);
  const wrongVersion = glb(baseDocument()); new DataView(wrongVersion.buffer).setUint32(4, 1, true);
  assert.throws(() => preflightAvatarModel(wrongVersion, "bad.glb"), /glb-version-unsupported/);
  const wrongLength = glb(baseDocument()); new DataView(wrongLength.buffer).setUint32(8, wrongLength.length - 4, true);
  assert.throws(() => preflightAvatarModel(wrongLength, "bad.glb"), /glb-length-mismatch/);
});

test("rejects malformed chunk boundaries and malformed glTF JSON", () => {
  const truncated = glb(baseDocument()); new DataView(truncated.buffer).setUint32(12, 0xfffffff0, true);
  assert.throws(() => preflightAvatarModel(truncated, "bad.glb"), /glb-chunk-out-of-bounds/);
  const invalidJson = glb(baseDocument()); invalidJson.fill(0x20, 20, invalidJson.length);
  invalidJson.set(new TextEncoder().encode("{broken"), 20);
  assert.throws(() => preflightAvatarModel(invalidJson, "bad.glb"), /gltf-json-invalid/);
});

test("rejects external resources that cannot survive local browser storage", () => {
  const externalBuffer = glb({ ...baseDocument(), buffers: [{ byteLength: 4, uri: "mesh.bin" }] });
  const externalImage = glb({ ...baseDocument(), images: [{ uri: "textures/face.png" }] });
  assert.throws(() => preflightAvatarModel(externalBuffer, "external.glb"), /external-buffer-uri-unsupported/);
  assert.throws(() => preflightAvatarModel(externalImage, "external.glb"), /external-image-uri-unsupported/);
});

test("enforces the same upload size ceiling before the renderer parses the binary", () => {
  assert.throws(() => preflightAvatarModel(new Uint8Array(MAX_AVATAR_MODEL_BYTES + 1), "oversize.glb"), /avatar-size-invalid/);
});
