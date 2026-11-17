import assert from 'node:assert/strict';
import { CognitiveToNeuralBridge, applyCognitiveNeuralControl } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

const bridge=new CognitiveToNeuralBridge();
const input={
  tick:17,action:'verify',mode:'deep',motivation01:.8,uncertainty01:.4,
  urgency01:.6,budgetRemaining01:.3,attention01:.7,
};
const before=structuredClone(input);
const profile=bridge.project(input);

assert.equal(profile.version,1);
assert.equal(profile.tick,17);
assert.equal(profile.action,'verify');
assert.equal(profile.mode,'deep');
assert.equal(profile.adapterHint,'deep');
assert.deepEqual(profile.featureVector01,[
  0,0,1,0,0,0,0,
  .8,.4,.6,.3,.7,
  0,0,0,1,0,0,0,
]);
assert.equal(profile.featureVector01.length,19);
assert.ok(profile.featureVector01.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
assert.equal(profile.maxTokens,448);
assert.equal(profile.temperature,.662);
assert.ok(Object.values(profile.steeringIntent01).every(value=>value>=0&&value<=.15));
assert.deepEqual(profile.controlsApplied,{
  samplingParameters:true,adapterSelection:false,activationSteering:false,residualBlock:false,
});
assert.deepEqual(input,before,'projection must not mutate organism state');

const malformed=bridge.project({
  tick:-1,action:'not-an-action',mode:'future-mode',
  motivation01:Number.NaN,uncertainty01:Number.POSITIVE_INFINITY,
  urgency01:-4,budgetRemaining01:4,attention01:undefined,
});
assert.equal(malformed.tick,0);
assert.equal(malformed.action,'none');
assert.equal(malformed.mode,'shallow');
assert.equal(malformed.adapterHint,'balanced');
assert.deepEqual(malformed.featureVector01.slice(0,7),[0,0,0,0,0,0,0]);
assert.deepEqual(malformed.featureVector01.slice(7,12),[0,.5,0,1,.5]);
assert.ok(malformed.featureVector01.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
assert.ok(malformed.temperature>=.2&&malformed.temperature<=.85);

const signal=new AbortController().signal;
const contextLedger={owner:'LanguageOrgan',totalInputChars:12};
const request={system:'system',user:'user',temperature:.7,maxTokens:512,signal,contextLedger};
const applied=applyCognitiveNeuralControl(request,profile);
assert.equal(applied.temperature,.662);
assert.equal(applied.maxTokens,448);
assert.equal(applied.cognitiveControl.tick,17);
assert.equal(applied.system,'system');
assert.equal(applied.user,'user');
assert.equal(applied.signal,signal);
assert.equal(applied.contextLedger,contextLedger);
assert.notEqual(applied.cognitiveControl,profile,'provider metadata must not alias mutable profile state');

const conservative=bridge.project({mode:'sleep',budgetRemaining01:0,uncertainty01:1});
assert.equal(conservative.adapterHint,'conservative');
assert.equal(conservative.maxTokens,96);
assert.ok(conservative.temperature>=.2&&conservative.temperature<=.85);
assert.ok(conservative.steeringIntent01.caution01<=.15);

console.log('COGNITIVE_TO_NEURAL_BRIDGE_PASS');
