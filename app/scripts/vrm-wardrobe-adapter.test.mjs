import assert from "node:assert/strict";
import test from "node:test";
import { attachVerifiedVrmGarment, inspectVrmGarmentRig } from "../src/components/avatar/vrmWardrobeAdapter.ts";

class Bone {
  constructor(name) { this.name=name; this.children=[]; this.constructorName="Bone"; }
}
class Skeleton {
  constructor(bones, boneInverses=bones.map((bone)=>({bone:bone.name}))) { this.bones=bones; this.boneInverses=boneInverses; }
}
class SkinnedMesh {
  constructor(name,bones) { this.name=name; this.isSkinnedMesh=true; this.skeleton=new Skeleton(bones); this.bindMatrix={identity:true}; this.userData={}; }
  bind(skeleton,matrix) { this.skeleton=skeleton; this.boundMatrix=matrix; }
  clone() { const copy=new SkinnedMesh(this.name,[...this.skeleton.bones]); copy.skeleton=this.skeleton; copy.bindMatrix=this.bindMatrix; copy.userData={...this.userData}; return copy; }
}
class Group {
  constructor(name="group") { this.name=name; this.children=[]; this.userData={}; this.visible=true; }
  add(child) { this.children.push(child); child.parent=this; }
  traverse(fn) { fn(this); for(const child of this.children) child.traverse?child.traverse(fn):fn(child); }
  clone() { const copy=new Group(this.name); copy.userData={...this.userData}; for(const child of this.children)copy.add(child.clone?child.clone():{...child}); return copy; }
}
function avatar() { const root=new Group("avatar"); const hips=new Bone("Hips"); const spine=new Bone("Spine"); const arm=new Bone("LeftUpperArm"); root.add(hips);root.add(spine);root.add(arm);return root; }
function garment(names=["Hips","Spine","LeftUpperArm"]) { const root=new Group("coat");root.add(new SkinnedMesh("coat-mesh",names.map((name)=>new Bone(name))));return root; }
const plan={status:"ready",expectedAssetIds:["coat-v1"]};

test("VRM garment rig maps all required bones by normalized names",()=>{
 const result=inspectVrmGarmentRig(garment(["hips","spine","left_upper_arm"]),avatar());
 assert.equal(result.compatible,true);assert.equal(result.garmentMeshCount,1);assert.equal(result.mappedBoneCount,3);
});
test("missing or ambiguous target bones fail closed",()=>{
 const missing=inspectVrmGarmentRig(garment(["Hips","Spine","Head"]),avatar());
 assert.equal(missing.compatible,false);assert.ok(missing.errors.includes("missing-avatar-bone:head"));
 const target=avatar();target.add(new Bone("Hips"));
 const duplicate=inspectVrmGarmentRig(garment(),target);
 assert.equal(duplicate.compatible,false);assert.ok(duplicate.errors.includes("avatar-duplicate-bone:hips"));
});
test("non-skinned artwork cannot be applied as a deforming VRM garment",()=>{
 const result=inspectVrmGarmentRig(new Group("flat-image"),avatar());
 assert.equal(result.compatible,false);assert.ok(result.errors.includes("garment-has-no-skinned-meshes"));
});
test("attachment requires a ready plan containing the exact asset id",()=>{
 const blocked=attachVerifiedVrmGarment({garmentRoot:garment(),avatarRoot:avatar(),slot:"outerwear",assetId:"other",plan});
 assert.equal(blocked.applied,false);assert.ok(blocked.errors.includes("wardrobe-plan-not-authorized-for-asset"));
});
test("compatible garment is remapped and attached without replacing another slot",()=>{
 const target=avatar();const result=attachVerifiedVrmGarment({garmentRoot:garment(),avatarRoot:target,slot:"outerwear",assetId:"coat-v1",plan});
 assert.equal(result.applied,true);assert.equal(result.replaced,0);
 const mesh=result.garmentRoot.children[0];
 assert.equal(mesh.skeleton.bones[0],target.children[0]);assert.equal(mesh.boundMatrix.identity,true);
 assert.equal(result.garmentRoot.userData.nk1WardrobeSlot,"outerwear");
});
test("successful replacement hides the prior garment only after new attachment",()=>{
 const target=avatar();const previous=new Group("old-coat");previous.userData={nk1WardrobeSlot:"outerwear"};target.add(previous);
 const result=attachVerifiedVrmGarment({garmentRoot:garment(),avatarRoot:target,slot:"outerwear",assetId:"coat-v1",plan});
 assert.equal(result.applied,true);assert.equal(result.replaced,1);assert.equal(previous.visible,false);
});
