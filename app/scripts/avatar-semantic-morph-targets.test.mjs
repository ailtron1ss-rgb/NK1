import assert from "node:assert/strict";
import test from "node:test";
import { applySemanticMorphTargets, resolveSemanticMorphTargets, semanticMorphValues, smoothSemanticMorphValues } from "../src/components/avatar/semanticMorphTargets.ts";

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
