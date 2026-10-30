import assert from "node:assert/strict";
import test from "node:test";
import { deriveBodyDynamics } from "../src/components/avatar/bodyDynamics.ts";
const base={emotion:"calm",arousal:.25,energy:.6,cognitiveLoad:.2,uncertainty:.2,awake:true};
test("body dynamics are deterministic and bounded for every affect state",()=>{
 for(const emotion of ["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"]){
  const a=deriveBodyDynamics({...base,emotion,elapsedSeconds:12.5}),b=deriveBodyDynamics({...base,emotion,elapsedSeconds:12.5});
  assert.deepEqual(a,b);
  for(const value of Object.values(a))assert.ok(Number.isFinite(value));
  assert.ok(a.breathsPerMinute>=6&&a.breathsPerMinute<=19);
  assert.ok(a.torsoScaleY>=1&&a.torsoScaleY<=1.008);
  assert.ok(Math.abs(a.verticalOffset)<=.008);
  assert.ok(Math.abs(a.weightShift)<=.006);
  assert.ok(a.shoulderLift>=0&&a.shoulderLift<=.007);
 }
});
test("arousal and acute affect increase cadence while calm and sleep slow it",()=>{
 const calm=deriveBodyDynamics({...base,emotion:"calm",arousal:.1,elapsedSeconds:3});
 const alert=deriveBodyDynamics({...base,emotion:"anxiety",arousal:.9,elapsedSeconds:3});
 const asleep=deriveBodyDynamics({...base,awake:false,elapsedSeconds:3});
 assert.ok(alert.breathsPerMinute>calm.breathsPerMinute);
 assert.ok(asleep.breathsPerMinute<calm.breathsPerMinute);
});
test("time advances the breathing phase without introducing random state",()=>{
 const a=deriveBodyDynamics({...base,elapsedSeconds:1});
 const b=deriveBodyDynamics({...base,elapsedSeconds:2});
 assert.notEqual(a.breathPhase,b.breathPhase);
 assert.equal(deriveBodyDynamics({...base,elapsedSeconds:1}).breathPhase,a.breathPhase);
});
test("malformed numeric inputs remain finite and inside safe bounds",()=>{
 const x=deriveBodyDynamics({...base,arousal:NaN,energy:Infinity,cognitiveLoad:-100,uncertainty:Infinity,elapsedSeconds:NaN});
 for(const value of Object.values(x))assert.ok(Number.isFinite(value));
 assert.ok(x.breathsPerMinute>=6&&x.breathsPerMinute<=19);
});

test("imported rig receives breath and head/shoulder offsets only through recognized bone names", async()=>{
 const {readFile}=await import("node:fs/promises");
 const stage=await readFile(new URL("../src/components/Avatar3DStage.tsx",import.meta.url),"utf8");
 assert.ok(stage.includes("deriveBodyDynamics"));
 assert.ok(stage.includes('n.includes("spine")||n.includes("chest")'));
 assert.ok(stage.includes("bodyMotion.breathPhase"));
 assert.ok(stage.includes("bodyMotion.shoulderLift"));
 assert.ok(stage.includes("bodyMotion.headSway"));
});
