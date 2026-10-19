import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(a=>[a,.5]));
const b=new NeuralExperienceBranch();
const baseline=b.diagnostics();
let learning=0;
for(let t=1;t<=600;t++){
  const input=Array.from({length:64},(_,i)=>Math.sin(t*.031+i*.17)*.55+Math.cos(t*.009+i*.07)*.2);
  const r=b.beforeDecision({tick:t,input,baseUtilities:utilities,predictionError01:.15+.45*Math.abs(Math.sin(t*.021)),novelty01:.2+.55*((t%17)/16),uncertainty01:.15+.55*((t%13)/12),homeostasis01:.1+.4*((t%11)/10),identityGap01:.1+.3*((t%7)/6),goalPressure01:.15+.6*((t%19)/18),reward01:t%2?.72:.38});
  const a=actions[t%actions.length]; b.commitAction(a,utilities);
  if(t%2===0){b.afterOutcome({tick:t,action:a,reward01:t%5===0?.86:.58,predictionError01:Math.abs(.5-r.prediction01),verified01:t%5===0?1:0,nextInput:input.map(x=>x*.97),holdout01:t%11===0?1:0});learning++;}
  if(t%16===0)b.replay(8);
}
const after=b.diagnostics();
const lesion=b.lesion(.45);
const snap=b.snapshot(); const restored=new NeuralExperienceBranch(); restored.restore(snap);
assert(after.cycles===600,'cycle count mismatch');
assert(after.learningUpdates>=learning,'learning did not accumulate');
assert(after.structuralUpdates>0,'structural plasticity never engaged');
assert(after.replayBuffer.length>0,'experience replay empty');
assert(after.holdoutSeen>0,'holdout evaluation never executed');
assert(after.computeCost01<.9,'branch compute budget exploded');
assert(restored.diagnostics().learningUpdates===after.learningUpdates,'persistence mismatch');
assert(Number.isFinite(lesion.causalDrop01),'causal lesion invalid');
console.log('B2522_NEURAL_EXPERIENCE_BRANCH_PASS',JSON.stringify({baseline:{neurons:baseline.neurons},after:{cycles:after.cycles,learningUpdates:after.learningUpdates,structuralUpdates:after.structuralUpdates,holdoutSeen:after.holdoutSeen,generalization01:after.generalization01,coherence01:after.coherence01,sparsity01:after.sparsity01,computeCost01:after.computeCost01},lesion}));
