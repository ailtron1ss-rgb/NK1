import { readFile } from "node:fs/promises";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

export function readGlbJson(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("invalid-glb-magic-or-header");
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported-glb-version");
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error("glb-length-mismatch");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error("truncated-glb-chunk");
    if (type === JSON_CHUNK) {
      return JSON.parse(buffer.toString("utf8", start, end).trimEnd());
    }
    offset = end;
  }
  throw new Error("missing-glb-json-chunk");
}

export function validateDepthRigGlb(input) {
  const errors = [];
  let gltf;
  try { gltf = readGlbJson(input); }
  catch (error) { return { ok: false, errors: [error instanceof Error ? error.message : "invalid-glb"] }; }

  const sceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;
  const scene = gltf.scenes?.[sceneIndex];
  const manifest = scene?.extras?.nk1DepthRigManifest;
  if (!scene) errors.push("missing-active-scene");
  if (!manifest || manifest.version !== 1 || manifest.units !== "scene") errors.push("missing-or-unsupported-depth-rig-manifest");
  if (typeof manifest?.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(manifest.id)) errors.push("invalid-rig-id");
  if (!Array.isArray(manifest?.nodes) || manifest.nodes.length === 0 || manifest.nodes.length > 128) {
    errors.push("node-count-out-of-range");
    return { ok: false, errors: [...new Set(errors)] };
  }

  const names = new Set((gltf.nodes ?? []).map((node) => node?.name).filter((name) => typeof name === "string"));
  const ids = new Set();
  const parents = new Map();
  const gltfParents = new Map();
  for (const [parentIndex, gltfNode] of (gltf.nodes ?? []).entries()) {
    for (const childIndex of gltfNode?.children ?? []) {
      const childName = gltf.nodes?.[childIndex]?.name;
      const parentName = gltfNode?.name;
      if (typeof childName === "string" && typeof parentName === "string") gltfParents.set(childName, parentName);
    }
  }
  for (const node of manifest.nodes) {
    if (!node || typeof node.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(node.id)) {
      errors.push("invalid-node-id");
      continue;
    }
    if (ids.has(node.id)) errors.push("duplicate-node:" + node.id);
    ids.add(node.id);
    if (!names.has(node.id)) errors.push("missing-glb-node:" + node.id);
    if (node.parentId !== null && typeof node.parentId !== "string") errors.push("invalid-parent:" + node.id);
    if (typeof node.parentId === "string") {
      parents.set(node.id, node.parentId);
      if (gltfParents.get(node.id) !== node.parentId) errors.push("parent-mismatch:" + node.id);
    }
    if (!Array.isArray(node.position) || node.position.length !== 3 || !node.position.every(Number.isFinite)) errors.push("invalid-position:" + node.id);
    if (!Array.isArray(node.pivot) || node.pivot.length !== 2 || !node.pivot.every(Number.isFinite)) errors.push("invalid-pivot:" + node.id);
    if (!Array.isArray(node.rotation) || node.rotation.length !== 3 || !node.rotation.every(Number.isFinite)) errors.push("invalid-rotation:" + node.id);
    if (!Number.isFinite(node.depth) || node.depth < -1 || node.depth > 1) errors.push("invalid-depth:" + node.id);
    if (!Number.isFinite(node.parallax) || node.parallax < 0 || node.parallax > 2) errors.push("invalid-parallax:" + node.id);
  }
  for (const [id, parentId] of parents) {
    if (!ids.has(parentId)) errors.push("missing-parent:" + id);
  }
  const visited = new Set();
  const active = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (active.has(id)) { errors.push("parent-cycle:" + id); return; }
    active.add(id);
    const parent = parents.get(id);
    if (parent && ids.has(parent)) visit(parent);
    active.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/depth-rig-glb-validator.mjs <model.glb>");
    process.exitCode = 2;
  } else {
    try {
      const result = validateDepthRigGlb(await readFile(file));
      if (!result.ok) {
        console.error("NK1 depth-rig GLB validation failed:", result.errors.join(", "));
        process.exitCode = 1;
      } else {
        console.log("NK1 depth-rig GLB validation passed.");
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
