import assert from "node:assert/strict";
import test from "node:test";
import { deriveFacialMicrochannels } from "../src/components/avatar/facialMicrochannels.ts";
const base={valence:.5,arousal:.5,dominance:.5,expressionIntensity:.7};
test("facial microchannels are finite, deterministic and bounded",()=>{
 for(const emotion of ["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"]){
  const a=deriveFacialMicrochannels({...base,emotion}),b=deriveFacialMicrochannels({...base,emotion});
  assert.deepEqual(a,b);
  for(const value of Object.values(a))assert.ok(Number.isFinite(value));
  assert.ok(a.eyeSmile>=0&&a.eyeSmile<=.8);
  assert.ok(a.browLeftY>=-.45&&a.browLeftY<=.45);
  assert.ok(a.browRightY>=-.45&&a.browRightY<=.45);
  assert.ok(a.browLeftForm>=-.5&&a.browLeftForm<=.5);
  assert.ok(a.browRightForm>=-.5&&a.browRightForm<=.5);
  assert.ok(a.cheek>=0&&a.cheek<=.38);
  assert.ok(a.mouthTension>=0&&a.mouthTension<=.55);
  assert.ok(a.blinkBias>=-.08&&a.blinkBias<=.2);
 }
});
test("joy activates cheek/eye smile while frustration adds mouth tension",()=>{
 const joy=deriveFacialMicrochannels({...base,emotion:"joy",valence:.9});
 const frustration=deriveFacialMicrochannels({...base,emotion:"frustration",valence:.2});
 assert.ok(joy.eyeSmile>0&&joy.cheek>0);
 assert.ok(frustration.mouthTension>joy.mouthTension);
});
test("malformed numeric inputs cannot escape normalized bounds",()=>{
 const x=deriveFacialMicrochannels({...base,emotion:"anger",valence:NaN,arousal:Infinity,dominance:-100,expressionIntensity:Infinity});
 for(const value of Object.values(x))assert.ok(Number.isFinite(value));
 assert.ok(x.mouthTension<=.55&&x.blinkBias<=.2);
});

test("Live2D adapter only addresses facial parameters present in the shipped CDI3 rig", async()=>{
 const {readFile}=await import("node:fs/promises");
 const cdi=JSON.parse(await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.cdi3.json",import.meta.url),"utf8"));
 const ids=new Set(cdi.Parameters.map((p)=>p.Id));
 for(const id of ["ParamEyeLSmile","ParamEyeRSmile","ParamBrowLY","ParamBrowRY","ParamBrowLForm","ParamBrowRForm","ParamCheek","ParamMouthForm"])assert.ok(ids.has(id),id);
 const viewer=await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html",import.meta.url),"utf8");
 for(const id of ["ParamEyeLSmile","ParamEyeRSmile","ParamBrowLY","ParamBrowRY","ParamBrowLForm","ParamBrowRForm","ParamCheek","ParamMouthForm"])assert.ok(viewer.includes(id),id);
});

test("temporal micro-motor cadence is bounded and responds to arousal/context",()=>{
 const calm=deriveFacialMicrochannels({...base,emotion:"calm",arousal:.1});
 const alert=deriveFacialMicrochannels({...base,emotion:"curiosity",arousal:.9});
 for(const profile of [calm,alert]){
  assert.ok(profile.blinkIntervalMs>=4200&&profile.blinkIntervalMs<=10500);
  assert.ok(profile.blinkDurationMs>=90&&profile.blinkDurationMs<=145);
  assert.ok(profile.saccadeIntervalMs>=1100&&profile.saccadeIntervalMs<=4200);
  assert.ok(profile.saccadeAmplitude>=.06&&profile.saccadeAmplitude<=.25);
 }
 assert.ok(alert.blinkIntervalMs<calm.blinkIntervalMs);
 assert.ok(alert.saccadeIntervalMs<calm.saccadeIntervalMs);
 assert.ok(alert.saccadeAmplitude>calm.saccadeAmplitude);
});
