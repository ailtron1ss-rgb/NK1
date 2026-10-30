import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeWardrobeSwitch, createWardrobeSwitchPlan, validateWardrobePackManifest, verifyWardrobeAssetBytes } from "../src/components/avatar/wardrobePack.ts";

const validManifest = () => ({
  schemaVersion: 1,
  packId: "kurisu-lab-pack",
  version: "1.0.0",
  creator: "NK1 wardrobe team",
  source: "https://example.org/asset-source",
  licenseId: "CC-BY-4.0",
  attribution: "Source artwork attribution",
  targetBodyId: "kurisu-vrm-body-v1",
  targetRigVersion: "humanoid-v1",
  assets: [{
    id: "lab-coat-vrm",
    garmentId: "coat-lab",
    slot: "outerwear",
    renderer: "vrm3d",
    path: "garments/lab-coat.glb",
    sha256: "a".repeat(64),
    bytes: 1024,
    mime: "model/gltf-binary",
  }],
});

test("wardrobe pack manifest accepts complete, bounded and attributable metadata", () => {
  const result = validateWardrobePackManifest(validManifest());
  assert.equal(result.valid, true);
  assert.equal(result.totalBytes, 1024);
  assert.deepEqual(result.errors, []);
});

test("wardrobe pack rejects missing licensing, non-HTTPS sources and invalid hashes", () => {
  const manifest = validManifest();
  manifest.licenseId = "";
  manifest.source = "http://example.org/source";
  manifest.assets[0].sha256 = "not-a-hash";
  const result = validateWardrobePackManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("manifest:license-required"));
  assert.ok(result.errors.includes("manifest:source-must-be-https"));
  assert.ok(result.errors.includes("asset:invalid-sha256:lab-coat-vrm"));
});

test("wardrobe pack rejects unsafe paths, duplicate paths and oversized assets", () => {
  const manifest = validManifest();
  manifest.assets.push({ ...manifest.assets[0], id: "second", path: "../escape.glb", bytes: 40 * 1024 * 1024 });
  const result = validateWardrobePackManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("asset:unsafe-path:second"));
  assert.ok(result.errors.includes("asset:invalid-size:second"));
  const duplicatePath = validManifest();
  duplicatePath.assets.push({ ...duplicatePath.assets[0], id: "second-asset" });
  assert.ok(validateWardrobePackManifest(duplicatePath).errors.includes("asset:duplicate-path:garments/lab-coat.glb"));
  const wrongMime = validManifest();
  wrongMime.assets[0].mime = "image/png";
  assert.ok(validateWardrobePackManifest(wrongMime).errors.includes("asset:mime-extension-mismatch:lab-coat-vrm"));
  const malformed = validManifest();
  malformed.assets[0] = null;
  assert.ok(validateWardrobePackManifest(malformed).errors.includes("asset:not-object"));
});

const request = (overrides = {}) => ({
  requestId: "switch-001",
  fromOutfitId: "casual",
  toOutfitId: "lab_coat",
  renderer: "vrm3d",
  expectedAssetIds: ["coat", "hair-clip"],
  targetBodyId: "kurisu-body-v1",
  targetRigVersion: "humanoid-v1",
  packBodyId: "kurisu-body-v1",
  packRigVersion: "humanoid-v1",
  packValidated: true,
  ...overrides,
});

test("switch plan blocks body/rig mismatch and unvalidated packs", () => {
  assert.ok(createWardrobeSwitchPlan(request({ packBodyId: "other-body" })).errors.includes("switch:body-mismatch"));
  assert.ok(createWardrobeSwitchPlan(request({ packRigVersion: "old-rig" })).errors.includes("switch:rig-mismatch"));
  assert.ok(createWardrobeSwitchPlan(request({ packValidated: false })).errors.includes("switch:pack-not-validated"));
});

test("wardrobe switch commits only after exact renderer acknowledgement", () => {
  const plan = createWardrobeSwitchPlan(request());
  const result = acknowledgeWardrobeSwitch(plan, {
    requestId: "switch-001",
    success: true,
    loadedAssetIds: ["coat", "hair-clip"],
  });
  assert.equal(result.committed, true);
  assert.equal(result.activeOutfitId, "lab_coat");
  assert.equal(result.rolledBack, false);
});

test("failed, partial or stale renderer acknowledgement preserves previous outfit", () => {
  const plan = createWardrobeSwitchPlan(request());
  const partial = acknowledgeWardrobeSwitch(plan, {
    requestId: "switch-001",
    success: true,
    loadedAssetIds: ["coat"],
  });
  assert.equal(partial.committed, false);
  assert.equal(partial.activeOutfitId, "casual");
  assert.equal(partial.rolledBack, true);
  const stale = acknowledgeWardrobeSwitch(plan, {
    requestId: "old-request",
    success: true,
    loadedAssetIds: ["coat", "hair-clip"],
  });
  assert.equal(stale.reason, "stale-acknowledgement");
  assert.equal(stale.activeOutfitId, "casual");
});

test("wardrobe byte verification checks actual SHA-256 and exact byte length", async () => {
  const bytes = new TextEncoder().encode("abc");
  const asset = { bytes: 3, sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" };
  const valid = await verifyWardrobeAssetBytes(asset, bytes);
  assert.equal(valid.valid, true);
  assert.equal(valid.reason, "verified");
  assert.equal(valid.actualSha256, asset.sha256);
  const wrongHash = await verifyWardrobeAssetBytes({ ...asset, sha256: "0".repeat(64) }, bytes);
  assert.equal(wrongHash.valid, false);
  assert.equal(wrongHash.reason, "hash-mismatch");
  const wrongSize = await verifyWardrobeAssetBytes({ ...asset, bytes: 4 }, bytes);
  assert.equal(wrongSize.valid, false);
  assert.equal(wrongSize.reason, "size-mismatch");
  const noCrypto = await verifyWardrobeAssetBytes(asset, bytes, { subtle: undefined });
  assert.equal(noCrypto.reason, "crypto-unavailable");
});
