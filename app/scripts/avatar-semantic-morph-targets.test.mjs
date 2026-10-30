import assert from "node:assert/strict";
import test from "node:test";
import { applySemanticMorphTargets, resolveSemanticMorphTargets, resolveVrmExpressionMorphTargets, resolveVrmHumanoidBoneRoles, semanticMorphValues, smoothSemanticMorphValues } from "../src/components/avatar/semanticMorphTargets.ts";

test("semantic resolver recognizes common VRM/GLB face morph labels",()=>{
 const targets=resolveSemanticMorphTargets({Joy:0,EyeBlinkLeft:1,eye_close_right:2,viseme_aa:3,viseme_O:4,Fcl_MTH_Sad:5,Fcl_EYE_Angry:6,UnknownRigChannel:7,Fcl_MTH_A:8,Fcl_MTH_O:9,negative:-1});
 assert.deepEqual(targets.map(x=>[x.index,x.channel]),[[0,"joy"],[1,"blink"],[2,"blink"],[3,"mouthOpen"],[4,"mouthOh"],[5,"sadness"],[6,"anger"],[8,"mouthOpen"],[9,"mouthOh"]]);
});
test("resolver leaves unknown morphs untouched and is deterministic",()=>{
 const dictionary={mystery:0,Joy:1,Smile:2,EyeBlinkLeft:3};
 assert.deepEqual(resolveSemanticMorphTargets(dictionary),resolveSemanticMorphTargets(dictionary));
 assert.deepEqual(resolveSemanticMorphTargets(dictionary).map(x=>x.index),[1,2,3]);
});
test("shared expression values synchronize affect, visemes and blink",()=>{
 const joy=semanticMorphValues({emotion:"joy",speaking:true,mouthOpen:.7,mouthForm:-.4,blink:.8});
 assert.equal(joy.joy,.75);assert.equal(joy.mouthOpen,.7);assert.equal(joy.mouthOh,.7);assert.equal(joy.blink,.8);
 const calm=semanticMorphValues({emotion:"calm",speaking:false,mouthOpen:.9,mouthForm:0,blink:0});
 assert.equal(calm.mouthOpen,0);assert.equal(calm.mouthOh,0);assert.equal(calm.joy,.08);
 const angry=semanticMorphValues({emotion:"anger",speaking:false,mouthOpen:1,mouthForm:0,blink:0});
 assert.equal(angry.anger,.7);
});
test("malformed viseme and blink values are safely clamped",()=>{
 const values=semanticMorphValues({emotion:"anxiety",speaking:true,mouthOpen:Infinity,mouthForm:-1,blink:NaN});
 assert.equal(values.mouthOpen,0);assert.equal(values.mouthOh,0);assert.equal(values.blink,0);
});

test("imported avatar stage applies the shared facial timeline through semantic targets",async()=>{
 const {readFile}=await import("node:fs/promises");
 const stage=await readFile(new URL("../src/components/Avatar3DStage.tsx",import.meta.url),"utf8");
 assert.ok(stage.includes("resolveSemanticMorphTargets"));
 assert.ok(stage.includes("semanticMorphValues"));
 assert.ok(stage.includes("blink:p.awake?facialMotion.blinkClosure*.92:0"));
 assert.ok(stage.includes("mouthOpen:p.mouthPose.open"));
 assert.ok(stage.includes("applySemanticMorphTargets(rt.morphTargets,rt.morphState)"));
 assert.ok(stage.includes("rt.morphTargets.push"));
 assert.ok(stage.includes("rt.morphTargets=[]"));
 const baselineReset=stage.indexOf("rt.morphTargets.forEach((target)=>{target.influences[target.index]=target.baseInfluence;})");
 const mixerUpdate=stage.indexOf("rt.mixer?.update(dt)");
 assert.ok(baselineReset>=0&&mixerUpdate>baselineReset,"baseline must be restored before authored animation updates");
});

test("semantic expression composes with stronger authored morph animation",()=>{
 const influences=[.9,.1,.25,.4];
 const bindings=[
  {influences,index:0,channel:"joy"},
  {influences,index:1,channel:"blink"},
  {influences,index:2,channel:"mouthOpen"},
  {influences,index:3,channel:"anger"}
 ];
 applySemanticMorphTargets(bindings,{joy:.2,sadness:0,anger:.7,mouthOpen:.8,mouthOh:0,blink:.6});
 assert.deepEqual(influences,[.9,.6,.8,.7]);
 applySemanticMorphTargets(bindings,{joy:0,sadness:0,anger:0,mouthOpen:0,mouthOh:0,blink:0});
 assert.deepEqual(influences,[.9,.6,.8,.7],"semantic layer must not erase a running authored clip");
});

test("imported expression smoothing is bounded with fast speech and slower affect release",()=>{
 const zero={joy:0,sadness:0,anger:0,mouthOpen:0,mouthOh:0,blink:0};
 const target={joy:1,sadness:0,anger:0,mouthOpen:1,mouthOh:1,blink:1};
 const first=smoothSemanticMorphValues(zero,target,.05);
 assert.ok(first.joy>0&&first.joy<1);
 assert.ok(first.mouthOpen>first.joy,"viseme channels must react faster than affect");
 const released=smoothSemanticMorphValues(first,zero,.05);
 assert.ok(released.mouthOpen<first.mouthOpen);
 assert.ok(released.joy/first.joy>released.mouthOpen/first.mouthOpen,"affect release must retain a larger fraction than speech release");
 const unchanged=smoothSemanticMorphValues(first,target,0);
 assert.deepEqual(unchanged,first);
});


test("VRM 1.0 preset expressions resolve official node-indexed morph binds",()=>{
 const influences=[0,0,.15];
 const mesh={morphTargetInfluences:influences};
 const root={traverse(fn){fn(mesh);}};
 const parser={associations:new Map([[mesh,{nodes:7,meshes:3}]]),json:{extensions:{VRMC_vrm:{expressions:{preset:{
  happy:{morphTargetBinds:[{node:7,index:0,weight:.8}]},
  blink:{morphTargetBinds:[{node:7,index:2,weight:1}]},
  aa:{morphTargetBinds:[{node:7,index:1,weight:.65}]},
  custom:{morphTargetBinds:[{node:7,index:0,weight:1}]}
 }}}}}};
 const bindings=resolveVrmExpressionMorphTargets(root,parser);
 assert.deepEqual(bindings.map(({index,channel,weight})=>[index,channel,weight]),[[0,"joy",.8],[2,"blink",1],[1,"mouthOpen",.65]]);
 const values={joy:1,sadness:0,anger:0,mouthOpen:1,mouthOh:0,blink:1};
 applySemanticMorphTargets(bindings,values);
 assert.deepEqual(influences,[.8,.65,1]);
});

test("VRM 0.x blendShapeGroups resolve mesh-indexed binds and percentage weights",()=>{
 const influences=[0,.1];
 const mesh={morphTargetInfluences:influences};
 const root={traverse(fn){fn(mesh);}};
 const parser={associations:new Map([[mesh,{meshes:4}]]),json:{extensions:{VRM:{blendShapeMaster:{blendShapeGroups:[
  {presetName:"joy",binds:[{mesh:4,index:0,weight:75}]},
  {presetName:"blink",binds:[{mesh:4,index:1,weight:100}]},
  {presetName:"unknown",binds:[{mesh:4,index:0,weight:100}]}
 ]}}}}};
 const bindings=resolveVrmExpressionMorphTargets(root,parser);
 assert.deepEqual(bindings.map(({index,channel,weight})=>[index,channel,weight]),[[0,"joy",.75],[1,"blink",1]]);
 applySemanticMorphTargets(bindings,{joy:1,sadness:0,anger:0,mouthOpen:0,mouthOh:0,blink:.5});
 assert.deepEqual(influences,[.75,.5]);
});

test("VRM resolver rejects malformed metadata and never guesses unknown channels",()=>{
 const mesh={morphTargetInfluences:[0]};
 const root={traverse(fn){fn(mesh);}};
 assert.deepEqual(resolveVrmExpressionMorphTargets(root,{associations:new Map([[mesh,{nodes:0}]]),json:{extensions:{VRMC_vrm:{expressions:{preset:{happy:{morphTargetBinds:[{node:0,index:99,weight:1},{node:-1,index:0,weight:1}]},unknown:{morphTargetBinds:[{node:0,index:0,weight:1}]}}}}}}}),[]);
 assert.deepEqual(resolveVrmExpressionMorphTargets(root,{}),[]);
});


test("VRM 1.0 humanoid roles map arbitrary bone names through node associations",()=>{
 const head={isBone:true,name:"Bone_004",rotation:{}},spine={isBone:true,name:"Armature_Bone_12",rotation:{}};
 const parser={associations:new Map([[head,{nodes:11}],[spine,{nodes:4}]]),json:{extensions:{VRMC_vrm:{humanoid:{humanBones:{head:{node:11},spine:{node:4},leftUpperArm:{node:99}}}}}}};
 const roles=resolveVrmHumanoidBoneRoles(parser);
 assert.equal(roles.get(head),"head");assert.equal(roles.get(spine),"spine");assert.equal(roles.size,2);
});

test("VRM 0.x humanoid bone arrays resolve legacy role names and ignore invalid nodes",()=>{
 const arm={isBone:true,name:"Bone_L_Arm",rotation:{}},neck={isBone:true,name:"Bone_Neck",rotation:{}};
 const parser={associations:new Map([[arm,{nodes:2}],[neck,{nodes:3}]]),json:{extensions:{VRM:{humanoid:{humanBones:[
  {bone:"leftUpperArm",node:2},{bone:"neck",node:3},{bone:"head",node:100}
 ]}}}}};
 const roles=resolveVrmHumanoidBoneRoles(parser);
 assert.equal(roles.get(arm),"leftupperarm");assert.equal(roles.get(neck),"neck");assert.equal(roles.size,2);
});
