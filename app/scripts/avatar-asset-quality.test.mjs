import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const live2dRoot=path.join(repoRoot,"runtime/neuro-kurisu/public/live2d");
const primaryPath=path.join(live2dRoot,"Kurisu/Kurisu.model3.json");
const mobilePath=path.join(live2dRoot,"Kurisu.mobile/Kurisu-mobile.model3.json");
const spritesRoot=path.join(repoRoot,"app/public");
const within=(root,target)=>target===root||target.startsWith(root+path.sep);

async function readModel(file){return JSON.parse(await readFile(file,"utf8"));}
function pngDimensions(bytes){
  assert.equal(bytes.toString("ascii",1,4),"PNG","expected a PNG signature");
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
async function verifyReferences(modelPath,model){
  const refs=model.FileReferences;
  const all=[refs.Moc,...(refs.Textures||[]),refs.Physics,refs.DisplayInfo,
    ...Object.values(refs.Motions||{}).flat().map(x=>x.File),...(refs.Expressions||[]).map(x=>x.File)].filter(Boolean);
  for(const relative of all){
    const absolute=path.resolve(path.dirname(modelPath),relative);
    assert.ok(within(live2dRoot,absolute),`reference escapes canonical Live2D root: ${relative}`);
    const info=await stat(absolute);
    assert.ok(info.isFile()&&info.size>0,`missing or empty model reference: ${relative}`);
  }
  return all;
}

test("desktop/mobile Live2D manifests reference shipped binaries, textures, physics, motions and expressions",async()=>{
  const primary=await readModel(primaryPath), mobile=await readModel(mobilePath);
  assert.equal(primary.Version,3);assert.equal(mobile.Version,3);
  assert.ok((await verifyReferences(primaryPath,primary)).length>=15);
  assert.ok((await verifyReferences(mobilePath,mobile)).length>=15);
  assert.deepEqual(Object.fromEntries(Object.entries(primary.FileReferences.Motions).map(([k,v])=>[k,v.length])),
    {Idle:1,TapHead:1,TapBody:1,Special:2});
  assert.equal(primary.FileReferences.Expressions.length,8);
});

test("mobile texture has the expected 2048px performance profile versus desktop 4096px",async()=>{
  const primary=await readModel(primaryPath), mobile=await readModel(mobilePath);
  const primaryTexture=await readFile(path.resolve(path.dirname(primaryPath),primary.FileReferences.Textures[0]));
  const mobileTexture=await readFile(path.resolve(path.dirname(mobilePath),mobile.FileReferences.Textures[0]));
  assert.deepEqual(pngDimensions(primaryTexture),{width:4096,height:4096});
  assert.deepEqual(pngDimensions(mobileTexture),{width:2048,height:2048});
  assert.ok(mobileTexture.length<primaryTexture.length*.5);
});

test("sprite manifest entries are unique, contained in public assets, and present",async()=>{
  const manifest=JSON.parse(await readFile(path.join(spritesRoot,"sprites/manifest.json"),"utf8"));
  assert.ok(Array.isArray(manifest.cells)&&manifest.cells.length>=30);
  const seen=new Set();
  for(const cell of manifest.cells){
    assert.ok(!seen.has(cell.id),`duplicate sprite id ${cell.id}`);seen.add(cell.id);
    const file=path.resolve(spritesRoot,cell.file);
    assert.ok(within(spritesRoot,file),`sprite escapes public root: ${cell.file}`);
    const info=await stat(file);
    assert.ok(info.isFile()&&info.size>20000,`missing/suspicious sprite: ${cell.file}`);
  }
});

test("canonical public Live2D asset locks still match file sizes and SHA-256",async()=>{
  const manifest=JSON.parse(await readFile(path.join(repoRoot,"contracts/inventory/canonical-public-assets-workpass42.json"),"utf8"));
  assert.equal(manifest.schemaVersion,1);assert.ok(Array.isArray(manifest.items)&&manifest.items.length>=15);
  for(const item of manifest.items){
    const file=path.resolve(repoRoot,item.canonicalPath);
    assert.ok(within(repoRoot,file),`unsafe canonical asset path ${item.canonicalPath}`);
    const bytes=await readFile(file);
    assert.equal(bytes.length,item.sizeBytes,`size drift: ${item.canonicalPath}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),item.sha256,`hash drift: ${item.canonicalPath}`);
  }
});
