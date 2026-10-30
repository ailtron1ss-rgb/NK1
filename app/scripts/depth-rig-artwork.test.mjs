import assert from "node:assert/strict";
import test from "node:test";
import { validateDepthRigArtwork } from "../src/components/avatar/depthRigArtwork.ts";

const upperRoles = [
  "head", "face", "eyes", "hair-front", "hair-back", "neck", "torso",
  "left-upper-arm", "left-forearm", "left-hand",
  "right-upper-arm", "right-forearm", "right-hand",
  "coat-front", "coat-tail",
];

function makeRig(roles = ["torso"]) {
  return {
    version: 1,
    id: "kurisu-depth-rig",
    units: "scene",
    nodes: [
      { id: "root", parentId: null, role: "root", position: [0, 0, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
      ...roles.map((role, index) => ({
        id: role, parentId: "root", role, position: [0, index * 0.01, 0],
        pivot: [0.5, 0.5], rotation: [0, 0, 0], depth: index / 100, parallax: 0.5,
      })),
    ],
  };
}

function makeArtwork(rig, overrides = {}) {
  const roleNodes = rig.nodes.filter((node) => node.role !== "root");
  const layers = roleNodes.map((node, index) => ({
    nodeId: node.id,
    role: node.role,
    assetPath: `layers/${node.id}.png`,
    image: { sha256: "a".repeat(64), widthPx: 16, heightPx: 16, hasAlpha: true },
    framePx: { x: index * 16, y: 0, width: 16, height: 16 },
    pivotPx: [8, 8],
    zIndex: index,
    occludes: node.role === "hair-front" ? ["eyes"] : [],
    hiddenRegions: "complete",
    evidenceIds: [`review-hidden-${node.id}`],
  }));
  return {
    version: 1,
    id: "kurisu-layered-master",
    rigId: rig.id,
    status: "production",
    bodyCoverage: "upper-body",
    coordinateSystem: "canvas-y-down",
    canvas: { widthPx: 512, heightPx: 512, unitsPerPixel: 0.002 },
    source: {
      kind: "layered-png",
      assetId: "kurisu-art-master",
      revision: "sha256:master-v1",
      licenseStatus: "verified",
      licenseReference: "verified-license-record-01",
    },
    views: ["front", "three-quarter-left", "three-quarter-right"],
    layers,
    visualReview: { status: "approved", reviewer: "art-review", reviewId: "review-001", reviewedAt: "2026-10-30T18:00:00Z" },
    ...overrides,
  };
}

function evidenceFor(artwork) {
  const ids = new Set(artwork.layers.map((layer) => layer.nodeId));
  return { renderableNodeIds: ids, texturedNodeIds: ids };
}

test("accepts a structurally valid blockout but never reports it as production-ready", () => {
  const rig = makeRig(["torso"]);
  const artwork = makeArtwork(rig, {
    status: "blockout",
    source: { kind: "layered-png", assetId: "kurisu-blockout", revision: "v0", licenseStatus: "pending" },
    views: ["front"],
    visualReview: { status: "pending" },
    layers: [{
      nodeId: "torso", role: "torso", assetPath: "layers/torso.png",
      image: { sha256: "b".repeat(64), widthPx: 16, heightPx: 16, hasAlpha: true },
      framePx: { x: 0, y: 0, width: 16, height: 16 }, pivotPx: [8, 8],
      zIndex: 0, occludes: [], hiddenRegions: "pending",
    }],
  });
  const result = validateDepthRigArtwork(artwork, rig);
  assert.equal(result.ok, true);
  assert.equal(result.productionReady, false);
  assert.ok(result.warnings.includes("artwork-license-not-verified"));
  assert.ok(result.warnings.some((warning) => warning.startsWith("missing-production-roles:")));
});

test("fails closed on unknown rig nodes, mismatched roles and unsafe asset paths", () => {
  const rig = makeRig(["torso"]);
  const artwork = makeArtwork(rig, {
    layers: [{
      nodeId: "unknown-node", role: "head", assetPath: "../private/head.png",
      image: { sha256: "c".repeat(64), widthPx: 16, heightPx: 16, hasAlpha: true },
      framePx: { x: 0, y: 0, width: 16, height: 16 }, pivotPx: [8, 8],
      zIndex: 0, occludes: [], hiddenRegions: "complete", evidenceIds: ["hidden-01"],
    }],
  });
  const result = validateDepthRigArtwork(artwork, rig);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("artwork-node-not-in-rig:unknown-node"));
  assert.ok(result.errors.includes("unsafe-artwork-asset-path:unknown-node"));
});

test("rejects non-alpha images, invalid hashes, out-of-canvas frames and pivots", () => {
  const rig = makeRig(["torso"]);
  const artwork = makeArtwork(rig, {
    layers: [{
      nodeId: "torso", role: "torso", assetPath: "layers/torso.png",
      image: { sha256: "not-a-hash", widthPx: 16, heightPx: 16, hasAlpha: false },
      framePx: { x: 500, y: 0, width: 16, height: 16 }, pivotPx: [50, -2],
      zIndex: 0, occludes: [], hiddenRegions: "pending",
    }],
  });
  const result = validateDepthRigArtwork(artwork, rig);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("invalid-artwork-image:torso"));
  assert.ok(result.errors.includes("artwork-frame-out-of-bounds:torso"));
  assert.ok(result.errors.includes("artwork-pivot-out-of-bounds:torso"));
});

test("requires front/back depth ordering for explicit occlusion relations", () => {
  const rig = makeRig(["eyes", "hair-front"]);
  const artwork = makeArtwork(rig, {
    layers: [
      { nodeId: "eyes", role: "eyes", assetPath: "layers/eyes.png", image: { sha256: "d".repeat(64), widthPx: 16, heightPx: 16, hasAlpha: true }, framePx: { x: 0, y: 0, width: 16, height: 16 }, pivotPx: [8, 8], zIndex: 5, occludes: [], hiddenRegions: "complete", evidenceIds: ["eyes-hidden"] },
      { nodeId: "hair-front", role: "hair-front", assetPath: "layers/hair-front.png", image: { sha256: "e".repeat(64), widthPx: 16, heightPx: 16, hasAlpha: true }, framePx: { x: 16, y: 0, width: 16, height: 16 }, pivotPx: [8, 8], zIndex: 4, occludes: ["eyes"], hiddenRegions: "complete", evidenceIds: ["hair-hidden"] },
    ],
  });
  const result = validateDepthRigArtwork(artwork, rig);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("occlusion-order-invalid:hair-front:eyes"));
});

test("requires actual renderable and textured scene evidence for production readiness", () => {
  const rig = makeRig(upperRoles);
  const artwork = makeArtwork(rig);
  const missingTexture = new Set(artwork.layers.slice(1).map((layer) => layer.nodeId));
  const result = validateDepthRigArtwork(artwork, rig, {
    renderableNodeIds: evidenceFor(artwork).renderableNodeIds,
    texturedNodeIds: missingTexture,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("artwork-node-not-textured:head"));
  assert.equal(result.productionReady, false);
});

test("only a reviewed, licensed, complete upper-body master with scene evidence is production-ready", () => {
  const rig = makeRig(upperRoles);
  const artwork = makeArtwork(rig);
  const result = validateDepthRigArtwork(artwork, rig, evidenceFor(artwork));
  assert.equal(result.ok, true);
  assert.equal(result.productionReady, true);
  assert.deepEqual(result.missingProductionRoles, []);
  assert.deepEqual(result.missingViews, []);
});

test("full-body production requires all lower-body semantic layers", () => {
  const rig = makeRig(upperRoles);
  const artwork = makeArtwork(rig, { bodyCoverage: "full-body" });
  const result = validateDepthRigArtwork(artwork, rig, evidenceFor(artwork));
  assert.equal(result.ok, true);
  assert.equal(result.productionReady, false);
  assert.ok(result.missingProductionRoles.includes("left-thigh"));
  assert.ok(result.missingProductionRoles.includes("right-foot"));
});

test("rejects duplicate node layers and invalid occlusion targets", () => {
  const rig = makeRig(["torso", "head"]);
  const artwork = makeArtwork(rig);
  artwork.layers.push({ ...artwork.layers[0], occludes: ["missing-layer"] });
  const result = validateDepthRigArtwork(artwork, rig);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("duplicate-artwork-layer:torso"));
  assert.ok(result.errors.includes("occlusion-target-missing:torso:missing-layer"));
});
