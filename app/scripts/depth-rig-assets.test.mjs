import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDepthRigAssetManifest,
} from "../src/components/avatar/depthRigAssetManifest.ts";

const transform = { x: 0, y: 0, z: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const node = (id, role, parentId, depthOrder) => ({
  id, role, parentId, depthOrder, pivot: { x: 0.5, y: 0.5 }, rest: { ...transform },
});
const rig = {
  version: 1,
  id: "kurisu-depth-rig",
  coordinateSystem: "normalized-y-down",
  nodes: [
    node("root", "root", null, 0),
    node("torso", "torso", "root", 1),
    node("head", "head", "torso", 2),
    node("hair-front", "hair-front", "head", 3),
    node("arm-left", "upper-arm-left", "torso", 4),
  ],
};
const manifest = {
  version: 1,
  id: "kurisu-2p5d-v1",
  rigId: rig.id,
  canvas: { width: 2048, height: 2048 },
  requiredNodeIds: ["torso", "head", "hair-front", "arm-left"],
  provenance: {
    creator: "NK1 art pipeline",
    licenseId: "CC-BY-4.0",
    reviewStatus: "approved",
    reviewedBy: "asset-reviewer",
    reviewedAt: "2026-11-02T10:00:00.000Z",
    evidencePath: "provenance/license-evidence.md",
  },
  assets: [
    { nodeId: "torso", assetPath: "layers/torso.png", pixelSize: { width: 2048, height: 2048 }, canvasRect: { x: 0, y: 0, width: 2048, height: 2048 }, deforms: true, hiddenAreaPaint: "complete", occlusionMode: "mask", occlusionMaskPaths: ["masks/torso.png"] },
    { nodeId: "head", assetPath: "layers/head.png", pixelSize: { width: 2048, height: 2048 }, canvasRect: { x: 0, y: 0, width: 2048, height: 2048 }, deforms: true, hiddenAreaPaint: "complete", occlusionMode: "mask", occlusionMaskPaths: ["masks/head.png"] },
    { nodeId: "hair-front", assetPath: "layers/hair-front.png", pixelSize: { width: 2048, height: 2048 }, canvasRect: { x: 0, y: 0, width: 2048, height: 2048 }, deforms: true, hiddenAreaPaint: "complete", occlusionMode: "mask", occlusionMaskPaths: ["masks/hair-front.png"] },
    { nodeId: "arm-left", assetPath: "layers/arm-left.png", pixelSize: { width: 2048, height: 2048 }, canvasRect: { x: 0, y: 0, width: 2048, height: 2048 }, deforms: true, hiddenAreaPaint: "complete", occlusionMode: "painted-overlap", occlusionMaskPaths: [] },
  ],
};
const inventory = [
  ...manifest.assets.map((asset) => ({ path: asset.assetPath, kind: "image", width: 2048, height: 2048, hasAlpha: true, byteLength: 1024 })),
  ...manifest.assets.flatMap((asset) => asset.occlusionMaskPaths.map((path) => ({ path, kind: "mask", width: 2048, height: 2048, hasAlpha: true, byteLength: 128 }))),
  { path: "provenance/license-evidence.md", kind: "evidence", byteLength: 256 },
];

const inspect = (candidate = manifest, files = inventory) =>
  validateDepthRigAssetManifest(rig, candidate, files);

test("accepts a complete, rights-reviewed layered 2.5D asset pack", () => {
  const result = inspect();
  assert.equal(result.status, "asset-preflight-pass");
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.checkedLayers, 4);
  assert.equal(result.checkedMasks, 3);
});

test("blocks promotion when a required rig node has no authored layer", () => {
  const candidate = { ...manifest, assets: manifest.assets.filter((asset) => asset.nodeId !== "head") };
  const result = inspect(candidate);
  assert.equal(result.status, "blocked");
  assert.ok(result.diagnostics.some((item) => item.code === "missing-required-layer" && item.nodeId === "head"));
});

test("rejects path traversal and absolute paths even if the inventory contains them", () => {
  const candidate = {
    ...manifest,
    assets: manifest.assets.map((asset) => asset.nodeId === "head" ? { ...asset, assetPath: "../outside/head.png" } : asset),
  };
  const files = [...inventory, { path: "../outside/head.png", kind: "image", width: 2048, height: 2048, hasAlpha: true, byteLength: 100 }];
  const result = inspect(candidate, files);
  assert.ok(result.diagnostics.some((item) => item.code === "unsafe-path" && item.nodeId === "head"));
  assert.equal(result.status, "blocked");
});

test("checks real asset dimensions, alpha channel and file presence", () => {
  const files = inventory.map((file) => file.path === "layers/torso.png"
    ? { ...file, width: 1024, hasAlpha: false }
    : file).filter((file) => file.path !== "layers/head.png");
  const result = inspect(manifest, files);
  assert.ok(result.diagnostics.some((item) => item.code === "asset-not-found" && item.nodeId === "head"));
  assert.ok(result.diagnostics.some((item) => item.code === "asset-metadata-mismatch" && item.nodeId === "torso"));
  assert.ok(result.diagnostics.some((item) => item.code === "asset-without-alpha" && item.nodeId === "torso"));
});

test("requires hidden-area paint and masks only when mask-driven occlusion is selected", () => {
  const candidate = {
    ...manifest,
    assets: manifest.assets.map((asset) => asset.nodeId === "arm-left"
      ? { ...asset, hiddenAreaPaint: "partial", occlusionMode: "mask", occlusionMaskPaths: [] }
      : asset),
  };
  const result = inspect(candidate);
  assert.ok(result.diagnostics.some((item) => item.code === "missing-hidden-paint" && item.nodeId === "arm-left"));
  assert.ok(result.diagnostics.some((item) => item.code === "missing-mask" && item.nodeId === "arm-left"));
});


test("allows painted-overlap occlusion without a redundant clipping mask", () => {
  const result = inspect();
  assert.equal(result.status, "asset-preflight-pass");
  assert.ok(!result.diagnostics.some((item) => item.code === "missing-mask"));
});

test("blocks a deforming layer that declares no occlusion strategy", () => {
  const candidate = {
    ...manifest,
    assets: manifest.assets.map((asset) => asset.nodeId === "arm-left"
      ? { ...asset, occlusionMode: "none", occlusionMaskPaths: [] }
      : asset),
  };
  const result = inspect(candidate);
  assert.ok(result.diagnostics.some((item) => item.code === "missing-occlusion-strategy" && item.nodeId === "arm-left"));
});

test("blocks unreviewed licensing and missing provenance evidence", () => {
  const candidate = {
    ...manifest,
    provenance: { ...manifest.provenance, reviewStatus: "review-required", evidencePath: "provenance/not-found.md" },
  };
  const result = inspect(candidate);
  assert.ok(result.diagnostics.some((item) => item.code === "license-not-approved"));
  assert.ok(result.diagnostics.some((item) => item.code === "license-evidence-missing"));
});

test("rejects foreign rigs, duplicate node layers and duplicate inventory paths", () => {
  const candidate = {
    ...manifest,
    rigId: "another-rig",
    assets: [...manifest.assets, manifest.assets[0]],
  };
  const files = [...inventory, inventory[0]];
  const result = inspect(candidate, files);
  assert.ok(result.diagnostics.some((item) => item.code === "rig-mismatch"));
  assert.ok(result.diagnostics.some((item) => item.code === "duplicate-node-layer"));
  assert.ok(result.diagnostics.some((item) => item.code === "duplicate-inventory-path"));
});

test("rejects canvas rectangles outside the shared artwork canvas", () => {
  const candidate = {
    ...manifest,
    assets: manifest.assets.map((asset) => asset.nodeId === "hair-front"
      ? { ...asset, canvasRect: { x: 1900, y: 0, width: 512, height: 2048 } }
      : asset),
  };
  const result = inspect(candidate);
  assert.ok(result.diagnostics.some((item) => item.code === "invalid-rect" && item.nodeId === "hair-front"));
});
