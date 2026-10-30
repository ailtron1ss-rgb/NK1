import assert from "node:assert/strict";
import test from "node:test";
import { prepareVerifiedWardrobeSwitch, isWardrobeRendererAcknowledgementComplete } from "../src/components/avatar/wardrobeRuntime.ts";

const bytes = new TextEncoder().encode("abc");
const manifest = () => ({
  schemaVersion: 1,
  packId: "kurisu-runtime-pack",
  version: "1.0.0",
  creator: "NK1",
  source: "https://example.org/wardrobe",
  licenseId: "CC-BY-4.0",
  attribution: "Example attribution",
  targetBodyId: "kurisu-body-v1",
  targetRigVersion: "humanoid-v1",
  assets: [{
    id: "coat-vrm",
    garmentId: "coat-lab",
    slot: "outerwear",
    renderer: "vrm3d",
    path: "garments/coat.glb",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    bytes: 3,
    mime: "model/gltf-binary",
  }],
});
const request = (overrides = {}) => ({
  requestId: "runtime-switch-1",
  fromOutfitId: "casual",
  toOutfitId: "lab_coat",
  renderer: "vrm3d",
  expectedAssetIds: ["coat-vrm"],
  targetBodyId: "kurisu-body-v1",
  targetRigVersion: "humanoid-v1",
  ...overrides,
});

test("runtime switch becomes ready only after manifest and actual bytes verify", async () => {
  const pack = manifest();
  const result = await prepareVerifiedWardrobeSwitch({
    manifest: pack,
    files: new Map([[pack.assets[0].path, bytes]]),
    request: request(),
  });
  assert.equal(result.ready, true);
  assert.equal(result.verification.valid, true);
  assert.equal(result.plan.status, "ready");
  assert.deepEqual(result.plan.expectedAssetIds, ["coat-vrm"]);
  assert.equal(isWardrobeRendererAcknowledgementComplete(result.plan, {
    requestId: "runtime-switch-1", success: true, loadedAssetIds: ["coat-vrm"],
  }), true);
});

test("tampered payload blocks renderer switch even with matching body and rig", async () => {
  const pack = manifest();
  const result = await prepareVerifiedWardrobeSwitch({
    manifest: pack,
    files: new Map([[pack.assets[0].path, new TextEncoder().encode("bad")]]),
    request: request(),
  });
  assert.equal(result.ready, false);
  assert.equal(result.verification.reason, "asset-invalid");
  assert.equal(result.plan.status, "blocked");
});

test("asset IDs from another renderer cannot enter the switch request", async () => {
  const pack = manifest();
  pack.assets.push({
    ...pack.assets[0],
    id: "coat-depth",
    renderer: "depth2d",
    path: "garments/coat.webp",
    mime: "image/webp",
  });
  const files = new Map([
    [pack.assets[0].path, bytes],
    [pack.assets[1].path, bytes],
  ]);
  const result = await prepareVerifiedWardrobeSwitch({
    manifest: pack,
    files,
    request: request({ expectedAssetIds: ["coat-depth"] }),
  });
  assert.equal(result.ready, false);
  assert.ok(result.errors.includes("switch:asset-not-in-renderer-manifest:coat-depth"));
});

test("wrong body or rig blocks activation after byte verification", async () => {
  const pack = manifest();
  const result = await prepareVerifiedWardrobeSwitch({
    manifest: pack,
    files: new Map([[pack.assets[0].path, bytes]]),
    request: request({ targetRigVersion: "different-rig" }),
  });
  assert.equal(result.verification.valid, true);
  assert.equal(result.ready, false);
  assert.ok(result.errors.includes("switch:rig-mismatch"));
});

test("acknowledgement helper rejects stale, partial and duplicate loaded assets", async () => {
  const pack = manifest();
  const result = await prepareVerifiedWardrobeSwitch({
    manifest: pack,
    files: new Map([[pack.assets[0].path, bytes]]),
    request: request(),
  });
  assert.equal(isWardrobeRendererAcknowledgementComplete(result.plan, {
    requestId: "stale", success: true, loadedAssetIds: ["coat-vrm"],
  }), false);
  assert.equal(isWardrobeRendererAcknowledgementComplete(result.plan, {
    requestId: "runtime-switch-1", success: true, loadedAssetIds: [],
  }), false);
  assert.equal(isWardrobeRendererAcknowledgementComplete(result.plan, {
    requestId: "runtime-switch-1", success: true, loadedAssetIds: ["coat-vrm", "coat-vrm"],
  }), false);
});
