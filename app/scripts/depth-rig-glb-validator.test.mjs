import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readGlbJson, validateDepthRigGlb } from "./depth-rig-glb-validator.mjs";

const manifest = (nodes = [
  { id: "root", parentId: null, role: "root", position: [0, 0, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
  { id: "head", parentId: "root", role: "head", position: [0, 1, 0], pivot: [0.5, 0.5], rotation: [0, 0, 0], depth: 0.2, parallax: 0.6 },
]) => ({ version: 1, id: "nk1-kurisu-2p5d", units: "scene", nodes });

function glb(json) {
  const payload = Buffer.from(JSON.stringify(json));
  const padding = (4 - (payload.length % 4)) % 4;
  const chunk = Buffer.concat([payload, Buffer.alloc(padding, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + chunk.length, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(chunk.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, chunkHeader, chunk]);
}

const document = (rig = manifest(), names = ["root", "head"]) => ({
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: [0], extras: { nk1DepthRigManifest: rig } }],
  nodes: names.map((name, index) => ({
    name,
    ...(index === 0 ? { children: [1] } : {}),
    ...(index === 1 ? { translation: [0, 1, 0] } : {}),
  })),
});

test("reads GLB v2 JSON chunk and validates the exported scene extras contract", () => {
  const input = glb(document());
  assert.equal(readGlbJson(input).asset.version, "2.0");
  assert.deepEqual(validateDepthRigGlb(input), { ok: true, errors: [] });
});

test("rejects a manifest node that is absent from the exported glTF hierarchy", () => {
  const result = validateDepthRigGlb(glb(document(manifest(), ["root"])));
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("missing-glb-node:head"));
});

test("rejects duplicate IDs, missing parents and cyclic manifest graphs", () => {
  const nodes = [
    { id: "root", parentId: "head", role: "root", position: [0, 0, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
    { id: "head", parentId: "root", role: "head", position: [0, 1, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
    { id: "head", parentId: "root", role: "head", position: [0, 1, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
    { id: "orphan", parentId: "missing", role: "custom", position: [0, 0, 0], pivot: [0, 0], rotation: [0, 0, 0], depth: 0, parallax: 0 },
  ];
  const result = validateDepthRigGlb(glb(document(manifest(nodes), ["root", "head", "orphan"])));
  assert.ok(result.errors.includes("duplicate-node:head"));
  assert.ok(result.errors.includes("missing-parent:orphan"));
  assert.ok(result.errors.some((error) => error.startsWith("parent-cycle:")));
});

test("fails closed for malformed or truncated GLB containers", () => {
  assert.ok(validateDepthRigGlb(Buffer.from("not a glb")).errors.includes("invalid-glb-magic-or-header"));
  const broken = glb(document()).subarray(0, 20);
  assert.ok(validateDepthRigGlb(broken).errors.includes("glb-length-mismatch"));
});

test("rejects manifest parent and local transforms that differ from exported glTF nodes", () => {
  const rig = manifest();
  rig.nodes[1].parentId = "not-the-exported-parent";
  rig.nodes[1].position = [9, 9, 9];
  const result = validateDepthRigGlb(glb(json));
  assert.ok(result.errors.includes("parent-mismatch:head"));
  assert.ok(result.errors.includes("position-mismatch:head"));
});

test("rejects a manifest root when the exported glTF places it beneath another node", () => {
  const json = document();
  json.nodes.push({ name: "unexpected-parent", children: [0] });
  json.nodes[0].children = [1];
  const result = validateDepthRigGlb(glb(json));
  assert.ok(result.errors.includes("parent-mismatch:root"));
});


test("accepts quaternion-to-Euler XYZ round trips and rejects exported rotation drift", () => {
  const json = document();
  const angle = Math.PI / 2;
  json.nodes[1].rotation = [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
  const rig = manifest();
  rig.nodes[1].rotation = [0, 0, angle];
  assert.deepEqual(validateDepthRigGlb(glb(json)), { ok: true, errors: [] });
  rig.nodes[1].rotation = [0, 0, 0];
  const result = validateDepthRigGlb(glb(document(rig)));
  assert.ok(result.errors.includes("rotation-mismatch:head"));
});

test("Avatar3DStage consumes scene extras for both depth rig and artist face bindings", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.ok(stage.includes("sceneRoot.userData?.nk1DepthRigManifest"));
  assert.ok(stage.includes("sceneRoot.userData?.nk1DepthRigFaceBindings"));
  assert.ok(stage.includes("applyDepthRigFaceMorphs(rt.loaded,faceValues,rt.faceBindings)"));
  assert.ok(stage.includes("rt.faceBindings={}"));
});

test("Blender exporter reconciles runtime transforms and parents from the exported glTF", async () => {
  const exporter = await readFile(new URL("../../tools/blender/export_nk1_depth_rig.py", import.meta.url), "utf8");
  assert.ok(exporter.includes("reconcile_manifest_with_gltf(manifest, document)"));
  assert.ok(exporter.includes("quaternion.to_euler(\"XYZ\")"));
  assert.ok(exporter.includes("parent outside the rig collection"));
  assert.ok(exporter.includes('extras["nk1DepthRigManifest"] = manifest'));
  assert.ok(exporter.includes('extras["nk1DepthRigFaceBindings"] = face_bindings'));
  assert.ok(exporter.includes("export_extras=True"));
});
