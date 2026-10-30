#!/usr/bin/env node
/** Reproducible local preflight for NK1 wardrobe authoring packs.
 * Checks manifest structure, exact bytes, SHA-256, MIME signatures and self-contained GLB v2.
 * Does not certify legal rights, visual quality, skin weights or final rig compatibility.
 */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateWardrobePackManifest } from "../src/components/avatar/wardrobePack.ts";

const signatures = {
  "image/png": b => b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
  "image/jpeg": b => b.length >= 3 && b[0]===255 && b[1]===216 && b[2]===255,
  "image/webp": b => b.length>=12 && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP",
  "model/gltf-binary": b => b.length>=12 && b.toString("ascii",0,4)==="glTF",
  "model/gltf+json": b => { try { JSON.parse(b.toString("utf8")); return true; } catch { return false; } },
};

function inspectGlb(bytes, id) {
  const errors=[];
  if(bytes.length<20 || bytes.toString("ascii",0,4)!=="glTF") return [`asset:${id}:glb-invalid-header`];
  if(bytes.readUInt32LE(4)!==2) errors.push(`asset:${id}:glb-version-not-2`);
  if(bytes.readUInt32LE(8)!==bytes.length) errors.push(`asset:${id}:glb-length-mismatch`);
  let offset=12, json=null, binLength=0, index=0;
  while(offset+8<=bytes.length) {
    const length=bytes.readUInt32LE(offset), type=bytes.readUInt32LE(offset+4); offset+=8;
    if(length%4!==0 || offset+length>bytes.length) { errors.push(`asset:${id}:glb-invalid-chunk-boundary`); break; }
    const chunk=bytes.subarray(offset,offset+length);
    if(index===0 && type!==0x4e4f534a) errors.push(`asset:${id}:glb-json-chunk-must-be-first`);
    if(type===0x4e4f534a) {
      if(json) errors.push(`asset:${id}:glb-duplicate-json-chunk`);
      else { try { json=JSON.parse(chunk.toString("utf8").replace(/[\\u0000\\u0020]+$/u,"")); } catch { errors.push(`asset:${id}:glb-json-invalid`); } }
    } else if(type===0x004e4942) {
      if(binLength) errors.push(`asset:${id}:glb-duplicate-bin-chunk`);
      binLength=length;
    } else errors.push(`asset:${id}:glb-unknown-chunk`);
    offset+=length; index++;
  }
  if(offset!==bytes.length) errors.push(`asset:${id}:glb-trailing-or-truncated-data`);
  if(!json) errors.push(`asset:${id}:glb-json-missing`);
  if(json) {
    for(const [i,b] of (json.buffers??[]).entries()) {
      if(b.uri) errors.push(`asset:${id}:glb-external-buffer:${i}`);
      if(Number.isFinite(b.byteLength)&&b.byteLength>binLength) errors.push(`asset:${id}:glb-buffer-exceeds-bin:${i}`);
    }
    for(const [i,img] of (json.images??[]).entries()) if(img.uri) errors.push(`asset:${id}:glb-external-image:${i}`);
    if(!Array.isArray(json.meshes)||!json.meshes.length) errors.push(`asset:${id}:glb-no-meshes`);
  }
  return errors;
}

export async function preflightWardrobePack({manifestPath,assetsRoot}) {
  let manifest;
  try { manifest=JSON.parse(await readFile(path.resolve(manifestPath),"utf8")); }
  catch(e) { return {valid:false,errors:[`manifest:read-or-parse-failed:${e.message}`],assetsChecked:0,totalBytes:0}; }
  const structural=validateWardrobePackManifest(manifest), errors=[...structural.errors];
  if(!structural.valid) return {valid:false,errors,assetsChecked:0,totalBytes:0};
  const root=await realpath(assetsRoot);
  let totalBytes=0, assetsChecked=0;
  for(const asset of manifest.assets) {
    let file;
    try {
      file=await realpath(path.resolve(root,asset.path));
      if(file!==root&&!file.startsWith(root+path.sep)) { errors.push(`asset:${asset.id}:path-escapes-root`); continue; }
    } catch { errors.push(`asset:${asset.id}:file-missing`); continue; }
    let bytes;
    try { bytes=await readFile(file); } catch { errors.push(`asset:${asset.id}:file-unreadable`); continue; }
    assetsChecked++; totalBytes+=bytes.length;
    if(bytes.length!==asset.bytes) errors.push(`asset:${asset.id}:byte-length-mismatch`);
    if(createHash("sha256").update(bytes).digest("hex")!==asset.sha256.toLowerCase()) errors.push(`asset:${asset.id}:sha256-mismatch`);
    if(!signatures[asset.mime]?.(bytes)) errors.push(`asset:${asset.id}:mime-signature-mismatch`);
    if(asset.mime==="model/gltf-binary") errors.push(...inspectGlb(bytes,asset.id));
  }
  return {valid:errors.length===0,errors,assetsChecked,totalBytes,packId:manifest.packId,version:manifest.version,targetBodyId:manifest.targetBodyId,targetRigVersion:manifest.targetRigVersion};
}

function args(argv) {
  const out={};
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==="--manifest") out.manifestPath=argv[++i];
    else if(argv[i]==="--assets") out.assetsRoot=argv[++i];
    else if(argv[i]==="--json") out.json=true;
    else if(argv[i]==="--help"||argv[i]==="-h") out.help=true;
    else throw new Error(`unknown-argument:${argv[i]}`);
  }
  return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const a=args(process.argv.slice(2));
    if(a.help) { process.stdout.write("Usage: node scripts/wardrobe-authoring-preflight.mjs --manifest <manifest.json> --assets <asset-root> [--json]\\n"); }
    else {
      if(!a.manifestPath||!a.assetsRoot) throw new Error("required:--manifest-and---assets");
      const r=await preflightWardrobePack(a);
      process.stdout.write(a.json?JSON.stringify(r,null,2)+"\\n":[`NK1 wardrobe ${r.packId??"unknown"}@${r.version??"unknown"}`,`Assets: ${r.assetsChecked}; bytes: ${r.totalBytes}`,`Result: ${r.valid?"PASS":"FAIL"}`,...r.errors.map(e=>"- "+e)].join("\\n")+"\\n");
      if(!r.valid) process.exitCode=1;
    }
  } catch(e) { process.stderr.write(e.message+"\\n"); process.exitCode=2; }
}
