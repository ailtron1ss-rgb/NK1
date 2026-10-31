import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { preflightWardrobePack } from "./wardrobe-authoring-preflight.mjs";

function glb(json) {
  const payload=Buffer.from(JSON.stringify(json));
  const padded=Buffer.concat([payload,Buffer.alloc((4-payload.length%4)%4,0x20)]);
  const header=Buffer.alloc(12);header.write("glTF",0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);
  const chunk=Buffer.alloc(8);chunk.writeUInt32LE(padded.length,0);chunk.writeUInt32LE(0x4e4f534a,4);
  return Buffer.concat([header,chunk,padded]);
}
async function fixture(t, bytes, mime="image/png") {
  const root=await mkdtemp(path.join(os.tmpdir(),"nk1-wardrobe-preflight-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,"assets"));
  const extensionByMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "model/gltf-binary": "glb",
    "model/gltf+json": "gltf",
  };
  const assetRelativePath = `assets/item.${extensionByMime[mime] ?? "bin"}`;
  const assetPath = path.join(root, assetRelativePath);
  await writeFile(assetPath,bytes);
  const manifest={schemaVersion:1,packId:"kurisu-lab-pack",version:"1.0.0",creator:"NK1 test fixture",source:"https://example.invalid/source",licenseId:"CC0-1.0",attribution:"Test-only synthetic fixture",targetBodyId:"nk1-vrm-test-body",targetRigVersion:"nk1-test-rig-v1",assets:[{id:"item-v1",garmentId:"coat-lab",slot:"outerwear",renderer:"vrm3d",path:assetRelativePath,sha256:createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length,mime}]};
  const manifestPath=path.join(root,"manifest.json");await writeFile(manifestPath,JSON.stringify(manifest));
  return {root,manifestPath,manifest,assetPath};
}
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test("authoring preflight accepts exact asset bytes, SHA-256 and MIME signature",async t=>{
 const f=await fixture(t,png);
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.equal(result.valid,true,result.errors.join(","));assert.equal(result.assetsChecked,1);assert.equal(result.totalBytes,png.length);
});

test("authoring preflight rejects payload tampering even when the manifest remains unchanged",async t=>{
 const f=await fixture(t,png);
 await writeFile(f.assetPath,Buffer.concat([png,Buffer.from([1])]));
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.equal(result.valid,false);assert.ok(result.errors.includes("asset:item-v1:byte-length-mismatch"),result.errors.join(","));assert.ok(result.errors.includes("asset:item-v1:sha256-mismatch"));
});

test("authoring preflight rejects content whose signature disagrees with the declared MIME",async t=>{
 const f=await fixture(t,Buffer.from("not an image"));
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.ok(result.errors.includes("asset:item-v1:mime-signature-mismatch"),result.errors.join(","));
});

test("authoring preflight rejects missing files and path traversal before attachment",async t=>{
 const f=await fixture(t,png);
 f.manifest.assets[0].path="../outside.png";await writeFile(f.manifestPath,JSON.stringify(f.manifest));
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.equal(result.valid,false);assert.ok(result.errors.some(x=>x.includes("unsafe-path")),result.errors.join(","));
});

test("authoring preflight accepts a self-contained GLB v2 with a mesh",async t=>{
 const bytes=glb({asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]});
 const f=await fixture(t,bytes,"model/gltf-binary");
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.equal(result.valid,true,result.errors.join(","));
});

test("authoring preflight rejects GLB external buffers and images",async t=>{
 const bytes=glb({asset:{version:"2.0"},buffers:[{uri:"https://example.invalid/body.bin",byteLength:4}],images:[{uri:"textures/coat.png"}],meshes:[{primitives:[]}]});
 const f=await fixture(t,bytes,"model/gltf-binary");
 const result=await preflightWardrobePack({manifestPath:f.manifestPath,assetsRoot:f.root});
 assert.ok(result.errors.includes("asset:item-v1:glb-external-buffer:0"),result.errors.join(","));
 assert.ok(result.errors.includes("asset:item-v1:glb-external-image:0"));
});
