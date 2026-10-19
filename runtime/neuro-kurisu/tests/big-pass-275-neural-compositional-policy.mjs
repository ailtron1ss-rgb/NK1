import assert from 'node:assert/strict';
import { B275NeuralCompositionalPolicy } from '../src/organism/cognition/B275NeuralCompositionalPolicy.ts';

const p=new B275NeuralCompositionalPolicy();
const self=Array.from({length:16},(_,i)=>Math.sin(i*.13));
const world=Array.from({length:16},(_,i)=>Math.cos(i*.09));
const asm=Array.from({length:16},(_,i)=>.15+(i%5)*.02);
const goal=[.7,.2,.4,.1,.6,.3,.2,.5];
const cand=['explore','verify','reflect','wait'].map((action,i)=>({id:`c${i}`,action,score:.2+i*.03,predictedUtility:.52+i*.02,predictedNeedRelief:.5,predictedCost:.3+i*.04,confidence:.58,generatedAt:0}));
let selected=0;
for(let t=0;t<220;t++){
  const r=p.decide({tick:t,candidates:cand,context:Array.from({length:16},(_,i)=>Math.sin(t*.03+i*.11)),selfLatent:self,worldLatent:world,neuralAssembly:asm,goalVector:goal,autonomy01:.72,personalityBias:{explore:.06,verify:.02,reflect:.01,wait:-.01},exploration01:.28});
  assert.ok(r.selected);
  const reward=r.selected==='explore' ? .78 : r.selected==='verify' ? .64 : .42;
  p.learnFromOutcome({tick:t,reward01:reward,predictionError01:.15+(t%7)*.01,selectedAction:r.selected,context:Array.from({length:16},(_,i)=>Math.sin(t*.03+i*.11)),goalVector:goal,selfLatent:self,worldLatent:world,neuralAssembly:asm,externalEvidence01:.8});
  selected += r.selected==='explore' ? 1 : 0;
}
const source=[{id:'s1',actions:['explore','verify'],reliability01:.82},{id:'s2',actions:['reflect','verify'],reliability01:.75}];
const comp=p.imagineComposition({tick:221,sourceSkills:source,context:world,goalVector:goal,selfLatent:self,neuralAssembly:asm});
assert.ok(comp,'composition not generated');
const ev=p.evaluateComposedPolicy({policyId:comp.id,gain01:.12,robustness01:.83,neuralGrounding01:.81,selfAlignment01:.78,personalityAlignment01:.74,predictionError01:.16});
assert.ok(ev.verified,'composed policy not verified');
const tr=p.transferPolicy({policyId:comp.id,context:self,goalVector:[-.2,.5,.3,.6,.1,.7,-.1,.4],neuralAssembly:asm,independentGain01:.09,robustness01:.8});
assert.ok(tr.gain01>=0);
const d=p.diagnostics();
assert.ok(d.learningUpdates>=200);assert.ok(d.imaginedCompositions>=1);assert.ok(d.verifiedPolicies>=1);assert.ok(d.neuralGrounding01>.4);assert.ok(selected>0);
const snap=p.snapshot();const q=new B275NeuralCompositionalPolicy();q.restore(snap);assert.deepEqual(q.snapshot(),snap);
console.log(JSON.stringify({pass:true,selectedExploreCount:selected,diagnostics:d,composition:comp,evaluation:ev,transfer:tr},null,2));
