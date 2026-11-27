import assert from "node:assert/strict";
import test from "node:test";
import { auditGlbSkinWeights } from "../src/components/avatar/avatarGlbSkinWeightAudit.ts";

function makeDocument({ includeWeights = true } = {}) {
  const nodes = [
    { name: "hips" },
    { name: "leftShoulder" },
    { name: "leftUpperArm" },
    { name: "CLOTH_labcoat_main", mesh: 0, skin: 0 },
  ];
  const bytes = new Uint8Array(60);
  bytes.set([
    1, 0, 0, 0,
    1, 2, 0, 0,
    2, 2, 0, 0,
  ], 0);
  const data = new DataView(bytes.buffer);
  const weights = [
    [1, 0, 0, 0],
    [0.5, 0.5, 0, 0],
    [0.25, 0.75, 0, 0],
  ];
  let offset = 12;
  for (const vertex of weights) {
    for (const weight of vertex) {
      data.setFloat32(offset, weight, true);
      offset += 4;
    }
  }
  const document = {
    nodes,
    skins: [{ joints: [0, 1, 2] }],
    meshes: [{
      name: "MESH_CLOTH_labcoat_main",
      primitives: [{ attributes: includeWeights ? { JOINTS_0: 0, WEIGHTS_0: 1 } : { JOINTS_0: 0 } }],
    }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 12 },
      { buffer: 0, byteOffset: 12, byteLength: 48 },
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5121, count: 3, type: "VEC4" },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: 3, type: "VEC4" },
    ],
  };
  return { document, binaryChunk: bytes };
}

test("samples actual GLB JOINTS_0/WEIGHTS_0 and reports per-mesh joint coverage", () => {
  const { document, binaryChunk } = makeDocument();
  const report = auditGlbSkinWeights(document, binaryChunk);
  assert.equal(report.skinnedNodeCount, 1);
  assert.equal(report.auditedNodeCount, 1);
  assert.equal(report.totalSampledVertices, 3);
  const mesh = report.meshAudits[0];
  assert.equal(mesh.nodeName, "CLOTH_labcoat_main");
  assert.equal(mesh.meshName, "MESH_CLOTH_labcoat_main");
  assert.equal(mesh.vertexCount, 3);
  assert.equal(mesh.sampledVertices, 3);
  assert.deepEqual(mesh.jointCoverage.map((item) => item.jointIndex), [1, 2]);
  assert.equal(mesh.jointCoverage[0].boneName, "leftShoulder");
  assert.equal(mesh.jointCoverage[0].coverage01, 2 / 3);
  assert.equal(mesh.jointCoverage[0].averageWeight01, 0.5);
  assert.equal(mesh.jointCoverage[1].boneName, "leftUpperArm");
  assert.equal(mesh.jointCoverage[1].coverage01, 2 / 3);
  assert.equal(mesh.jointCoverage[1].averageWeight01, 0.5);
  assert.equal(report.warnings.length, 0);
});

test("normalized unsigned-byte weights are decoded and sampling respects its hard budget", () => {
  const { document, binaryChunk } = makeDocument();
  const bytes = new Uint8Array(24);
  bytes.set([255, 0, 0, 0, 128, 127, 0, 0, 0, 255, 0, 0], 0);
  // Keep the joint buffer and use a compact normalized byte weight buffer.
  const compact = new Uint8Array(24);
  compact.set(binaryChunk.subarray(0, 12), 0);
  compact.set(bytes.subarray(0, 12), 12);
  document.bufferViews[1] = { buffer: 0, byteOffset: 12, byteLength: 12 };
  document.accessors[1] = { bufferView: 1, byteOffset: 0, componentType: 5121, normalized: true, count: 3, type: "VEC4" };
  const report = auditGlbSkinWeights(document, compact, { maxSamplesPerPrimitive: 2 });
  const mesh = report.meshAudits[0];
  assert.equal(mesh.sampledVertices, 2);
  assert.equal(mesh.vertexCount, 3);
  assert.equal(report.totalSampledVertices, 2);
  assert.ok(mesh.jointCoverage.every((item) => item.averageWeight01 >= 0 && item.averageWeight01 <= 1));
});

test("missing or malformed skin attributes fail closed and do not invent joint weights", () => {
  const missing = makeDocument({ includeWeights: false });
  const report = auditGlbSkinWeights(missing.document, missing.binaryChunk);
  assert.equal(report.skinnedNodeCount, 1);
  assert.equal(report.auditedNodeCount, 0);
  assert.deepEqual(report.meshAudits[0].jointCoverage, []);
  assert.ok(report.warnings.includes("missing-joint-weight-attributes"));

  const malformed = makeDocument();
  malformed.document.accessors[1].count = 2;
  const bad = auditGlbSkinWeights(malformed.document, malformed.binaryChunk);
  assert.equal(bad.auditedNodeCount, 0);
  assert.ok(bad.warnings.includes("joint-weight-count-mismatch"));
});

test("out-of-range joint indices are rejected without mapping to a different bone", () => {
  const { document, binaryChunk } = makeDocument();
  const modified = new Uint8Array(binaryChunk);
  modified[0] = 99;
  const report = auditGlbSkinWeights(document, modified);
  assert.ok(report.warnings.includes("joint-index-out-of-range"));
  assert.equal(report.meshAudits[0].jointCoverage.some((item) => item.jointIndex === 99), false);
});


test("reports unweighted vertices and per-vertex weight-sum diagnostics without inventing influences", () => {
  const { document, binaryChunk } = makeDocument();
  const data = new DataView(binaryChunk.buffer);
  // The third vertex has no active weights. This is reported as a gap.
  data.setFloat32(44, 0, true);
  data.setFloat32(48, 0, true);
  data.setFloat32(52, 0, true);
  data.setFloat32(56, 0, true);
  const report = auditGlbSkinWeights(document, binaryChunk);
  const mesh = report.meshAudits[0];
  assert.equal(mesh.sampledVertices, 3);
  assert.equal(mesh.unweightedSampleVertices, 1);
  assert.equal(mesh.weightedSampleVertices, 2);
  assert.ok(mesh.averageWeightSum01 > 0 && mesh.averageWeightSum01 < 1);
  assert.equal(mesh.maxWeightSum01, 1);
  assert.equal(mesh.unweightedSampleVertices + mesh.weightedSampleVertices, mesh.sampledVertices);
});
