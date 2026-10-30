import assert from "node:assert/strict";
import test from "node:test";
import { resolveSemanticMorphTargets, semanticMorphValues } from "../src/components/avatar/semanticMorphTargets.ts";

test("semantic resolver recognizes common VRM/GLB face morph labels",()=>{
 const targets=resolveSemanticMorphTargets({Joy:0,EyeBlinkLeft:1,eye_close_right:2,viseme_aa:3,viseme_O:4,Fcl_MTH_Sad:5,Fcl_EYE_Angry:6,UnknownRigChannel:7,negative:-1});
 assert.deepEqual(targets.map(x=>[x.index,x.channel]),[[0,"joy"],[1,"blink"],[2,"blink"],[3,"mouthOpen"],[4,"mouthOh"],[5,"sadness"],[6,"anger"]]);
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
