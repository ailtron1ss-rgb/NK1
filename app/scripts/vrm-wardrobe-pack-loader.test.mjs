import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { applyVerifiedVrmWardrobePack, inspectSelfContainedGlb } from "../src/components/avatar/vrmWardrobePackLoader.ts";

class Bone {
  constructor(name) { this.name=name; this.isBone=true; this.children=[]; }
  traverse(fn) { fn(this); for(const child of this.children) child.traverse?.(fn); }
}
class Skeleton {
  constructor(bones, inverses=bones.map((bone)=>({bone:bone.name}))) { this.bones=bones; this.boneInverses=inverses; }
}
class SkinnedMesh {
  constructor(name,bones) { this.name=name; this.isSkinnedMesh=true; this.skeleton=new Skeleton(bones); this.bindMatrix={identity:true}; this.userData={}; }
  bind(skeleton,matrix) { this.skeleton=skeleton; this.boundMatrix=matrix; }
  clone() { const mesh=new SkinnedMesh(this.name,[...this.skeleton.bones]);mesh.skeleton=this.skeleton;mesh.bindMatrix=this.bindMatrix;return mesh; }
  traverse(fn) { fn(this); }
}
class Group {
  constructor(name="group") { this.name=name;this.children=[];this.userData={};this.visible=true; }
  add(node) { this.children.push(node);node.parent=this; }
  remove(node) { this.children=this.children.filter((item)=>item!==node);node.parent=null; }
  traverse(fn) { fn(this);for(const child of this.children)child.traverse?.(fn); }
  clone() { const copy=new Group(this.name);copy.userData={...this.userData};for(const child of this.children)copy.add(child.clone?.()??child);return copy; }
}
function avatar() {
  const root=new Group("avatar"), hips=new Bone("Hips"), spine=new Bone("Spine"), arm=new Bone("LeftUpperArm");
  root.add(hips);root.add(spine);root.add(arm);root.add(new SkinnedMesh("body",[hips,spine,arm]));return root;
}
function garment() { const root=new Group("coat");root.add(new SkinnedMesh("coat-mesh",["Hips","Spine","LeftUpperArm"].map((name)=>new Bone(name))));return root; }
function glb(uri) {
  const json=JSON.stringify({asset:{version:"2.0"},scene:0,scenes:[{nodes:[]}],...(uri?{images:[{uri}]}:{})});
  const padded=json+" ".repeat((4-json.length%4)%4),chunk=new TextEncoder().encode(padded);
  const bytes=new Uint8Array(20+chunk.length),view=new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.length,true);
  view.setUint32(12,chunk.length,true);view.setUint32(16,0x4e4f534a,true);bytes.set(chunk,20);return bytes;
}
function inputFor(bytes, target=avatar()) {
  const digest=createHash("sha256").update(bytes).digest("hex");
  const manifest={schemaVersion:1,packId:"test-pack",version:"1.0.0",creator:"NK1",source:"https://example.org/wardrobe",licenseId:"CC-BY-4.0",attribution:"Test attribution",targetBodyId:"kurisu-v1",targetRigVersion:"humanoid-v1",assets:[{id:"coat-v1",garmentId:"lab-coat",slot:"outerwear",renderer:"vrm3d",path:"garments/coat.glb",sha256:digest,bytes:bytes.byteLength,mime:"model/gltf-binary"}]};
  return {manifest,files:new Map([["garments/coat.glb",bytes]]),request:{requestId:"switch-1",fromOutfitId:"casual",toOutfitId:"lab_coat",renderer:"vrm3d",expectedAssetIds:["coat-v1"],targetBodyId:"kurisu-v1",targetRigVersion:"humanoid-v1"},avatarRoot:target};
}

test("GLB container inspection rejects external image and buffer URLs",()=>{
  assert.equal(inspectSelfContainedGlb(glb()).valid,true);
  assert.deepEqual(inspectSelfContainedGlb(glb("https://evil.example/texture.png")).errors,["glb:external-resource-uri-rejected"]);
  assert.deepEqual(inspectSelfContainedGlb(new Uint8Array([1,2,3])).errors,["glb:invalid-header"]);
});

test("verified self-contained GLB pack is parsed, rig-checked and applied as one outfit switch",async()=>{
  const target=avatar(),old=new Group("old-coat");old.userData={nk1WardrobeSlot:"outerwear"};target.add(old);
  const input=inputFor(glb(),target);
  const result=await applyVerifiedVrmWardrobePack({...input,parseGlb:async()=>({scene:garment()})});
  assert.equal(result.committed,true);assert.deepEqual(result.loadedAssetIds,["coat-v1"]);
  assert.equal(old.visible,false);
  assert.equal(target.children.some((node)=>node.userData?.nk1WardrobeAssetId==="coat-v1"),true);
});

test("GLB parse failure leaves the previous outfit and avatar hierarchy untouched",async()=>{
  const target=avatar(),old=new Group("old-coat");old.userData={nk1WardrobeSlot:"outerwear"};target.add(old);
  const before=target.children.length,input=inputFor(glb(),target);
  const result=await applyVerifiedVrmWardrobePack({...input,parseGlb:async()=>{throw new Error("decoder-failed");}});
  assert.equal(result.committed,false);assert.equal(target.children.length,before);assert.equal(old.visible,true);
});

test("external-resource GLB is rejected before the parser can run",async()=>{
  const bytes=glb("https://example.org/remote.png"),input=inputFor(bytes);
  let parsed=false;
  const result=await applyVerifiedVrmWardrobePack({...input,parseGlb:async()=>{parsed=true;return {scene:garment()};}});
  assert.equal(result.committed,false);assert.equal(parsed,false);
  assert.ok(result.errors.includes("coat-v1:glb:external-resource-uri-rejected"));
});
