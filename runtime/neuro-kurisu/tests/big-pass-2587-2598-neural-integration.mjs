import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.48]));
const x=new NeuralExperienceBranch();
for(let t=1;t<=960;t++){
  const input=Array.from({length:64},(_,i)=>((i*11+t*5)%53)/52);
  const r=x.beforeDecision({tick:t,input,baseUtilities:base,predictionError01:t%37===0?.72:.12+.16*((t*7)%11)/10,novelty01:.18+.12*(t%5)/4,uncertainty01:.26+.30*(t%7)/6,homeostasis01:.25,identityGap01:.18,goalPressure01:.62+.16*(t%9)/8,reward01:t%4? .72:.34,embodied:{sensorFeatures:input}});
  const action=A.reduce((best,a)=>r.actionBias[a]>r.actionBias[best]?a:best,'respond');
  x.commitAction(action,base);
  const next=input.map((v,i)=>Math.max(-1,Math.min(1,v+(i%8===0?(action==='explore'?.12:-.04):0))));
  x.afterOutcome({tick:t,action,reward01:(action==='explore'&&t%3===0)?.86:action==='verify'?.76:.58,predictionError01:t%37===0?.78:.10+.18*((t*13)%17)/16,verified01:t%3===0?1:.72,nextInput:next,holdout01:t>700&&t%5===0?1:0,goalPressure01:.68,identityGap01:.16,embodied:{nextFeatures:next}});
  if(t%32===0)x.replay(6);
}
const d=x.diagnostics();
assert(d.transferableSkills.skills.length>0,'no transferable skills were learned');
assert(d.transferableSkills.optionCoverage01>0.01,'transferable option coverage is dormant');
assert(d.transferableSkills.interventionProbes>0,'active intervention layer is dormant');
assert(d.transferableSkills.recoveries>0,'recovery mechanism is dormant');
assert(d.transfer01>=0);
const snap=x.diagnostics(); const y=new NeuralExperienceBranch(); y.restore(snap); const persisted=y.diagnostics();
assert(persisted.transferableSkills.skills.length===d.transferableSkills.skills.length);
assert(Math.abs(persisted.transferableSkills.transfer01-d.transferableSkills.transfer01)<1e-12);
console.log('B2587_2598_NEURAL_INTEGRATION_PASS',JSON.stringify({cycles:d.cycles,skills:d.transferableSkills.skills.length,transfer01:d.transfer01,skillTransfer:d.transferableSkills.transfer01,optionCoverage01:d.transferableSkills.optionCoverage01,abstractionGain01:d.transferableSkills.abstractionGain01,interventionProbes:d.transferableSkills.interventionProbes,recoveries:d.transferableSkills.recoveries,horizonDepth:d.embodiedBridge.selectedHorizonDepth,holdoutSeen:d.holdoutSeen,generalization01:d.generalization01}));
