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
