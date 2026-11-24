import assert from 'node:assert/strict';
import { B288SocialPredictiveSelfOtherBrain } from '../src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts';

const brain=new B288SocialPredictiveSelfOtherBrain();
for(let t=1;t<=320;t++){
  const person=t%2===0?'A':'B';
  const hidden=person==='A'?.88:.16;
  const action=hidden>.5 ? 'respond':'verify';
  const reward=action==='respond' ? hidden : 1-hidden;
  brain.step(person,{
    selfLatent:Array.from({length:24},(_,i)=>Math.sin(t*.07+i*.03)),
    worldLatent:Array.from({length:24},(_,i)=>Math.cos(t*.05+i*.05+hidden)),
    goalVector:[hidden,1-hidden,.35], futureSelf:Array.from({length:32},(_,i)=>Math.sin(t*.02+i*.04)),
    personalityVector:Array.from({length:24},(_,i)=>(i%8-3.5)/5), relationshipLatent:[hidden,1-hidden,.3+hidden*.4],
    action,reward01:reward,predictionError01:Math.abs(reward-.5),surprise01:Math.abs(reward-.5),importance01:.72,
    socialPredictionError01:Math.abs(reward-.7), socialState:{trust01:hidden,warmth01:hidden,predictability01:.55+hidden*.35,guardedness01:1-hidden,agency01:.65,intentUncertainty01:1-hidden,relationshipStrength01:.25+hidden*.55}
  });
}
const d=brain.diagnostics();
assert.equal(d.persons.length,2);
assert(d.learningUpdates>=300);
assert(d.relationshipDifferentiation01>.08);
assert(d.neuralActivity01>0.01);
assert(d.meanPrediction01>.5);
const a=brain.actionBias('respond','A');
const b=brain.actionBias('respond','B');
assert(Math.abs(a-b)>.0005);
const ab=brain.lesion('A',.55);
assert(ab>0);
const snap=brain.snapshot();
const restored=new B288SocialPredictiveSelfOtherBrain();restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);
const ev=brain.personalityEvidence('A');
assert(ev.length>=6);
console.log(JSON.stringify({pass:true,diagnostics:d,respondBiasA:a,respondBiasB:b,biasDelta:Math.abs(a-b),lesion:ab,personalityEvidence:ev.length,restart:true}));
