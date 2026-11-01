import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { KURISU_HYBRID_MODEL } from "../src/components/avatar/avatarModelCatalog.ts";
import { preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";

const response = await fetch(KURISU_HYBRID_MODEL.url, {
  method: "GET",
  mode: "cors",
  credentials: "omit",
  cache: "no-store",
  signal: AbortSignal.timeout(20_000),
});
assert.equal(response.ok, true, `Hosted Kurisu model returned HTTP ${response.status}`);
assert.match(response.headers.get("content-type") ?? "", /^model\/gltf-binary(?:;|$)/i);
const bytes = new Uint8Array(await response.arrayBuffer());
assert.equal(bytes.byteLength, KURISU_HYBRID_MODEL.sizeBytes, "Hosted asset size must match the pinned catalog");
const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
assert.equal(sha256, KURISU_HYBRID_MODEL.sha256, "Hosted asset content must match its pinned SHA-256");
const preflight = preflightAvatarModel(bytes, KURISU_HYBRID_MODEL.filename);
assert.equal(preflight.format, "glb");
assert.equal(preflight.hasBinaryChunk, true);

const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jsonLength = view.getUint32(12, true);
const document = JSON.parse(new TextDecoder("utf-8", { fatal: true })
  .decode(bytes.subarray(20, 20 + jsonLength)).trim());
const morphTargets = (document.meshes ?? []).reduce((sum, mesh) =>
  sum + (mesh.primitives ?? []).reduce((n, primitive) => n + (primitive.targets?.length ?? 0), 0), 0);
assert.ok((document.nodes?.length ?? 0) > 0, "Hosted model must contain scene nodes");
assert.ok((document.skins?.length ?? 0) > 0, "Hosted model must contain a humanoid skin");
assert.ok(morphTargets >= 10, "Hosted model must retain face and blink morph targets");
assert.ok((document.animations ?? []).some((animation) => /rig_kurisu/i.test(animation.name ?? "")), "Hosted model must retain the named Kurisu humanoid clip");

console.log("HOSTED_KURISU_ASSET=PASS", JSON.stringify({
  id: KURISU_HYBRID_MODEL.id,
  bytes: bytes.byteLength,
  sha256,
  nodes: document.nodes.length,
  meshes: document.meshes.length,
  morphTargets,
  animations: (document.animations ?? []).length,
}));
