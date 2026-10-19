import assert from 'node:assert/strict';
import { EmbodiedCausalWorldBridge } from '../src/organism/cognition/EmbodiedCausalWorldBridge.ts';
import { B2521LearnedGenerativeOrganismLoop } from '../src/organism/cognition/B2521LearnedGenerativeOrganismLoop.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const bridge=new EmbodiedCausalWorldBridge();
for(let t=1;t<=160;t++){
  const budget=t%4===0?.92:t%4===1?.74:.42;
  const r=bridge.beforeDecision({tick:t,features:Array.from({length:64},(_,i)=>((i+t)%19)/18),actionUtilities:base,novelty01:.55,uncertainty01:.68,predictionError01:.28,computeBudget01:budget});
  assert([4,8,16].includes(r.horizonDepth) || r.horizonDepth===1);
  const action=r.selectedActionHint;
  bridge.afterOutcome({tick:t,action,nextFeatures:Array.from({length:64},(_,i)=>((i+t+(i%3===0?1:0))%19)/18),reward01:.55+.25*(t%5===0?1:0),verified01:t%3===0?1:.7,predictionError01:.15});
}
const bm=bridge.metrics();
assert(bm.horizonErrors.length===5,'H1/H2/H4/H8/H16 telemetry missing');
assert(bm.horizonConfidence01.length===5);
assert(bm.horizonCounts[3]>0 && bm.horizonCounts[4]>0,'long-horizon learning did not execute');

const g=new B2521LearnedGenerativeOrganismLoop();
for(let t=1;t<=320;t++){
  const latent=Array.from({length:32},(_,i)=>((i*5+t*2)%37)/36);
  g.beforeDecision({tick:t,latent,baseUtilities:base,goalPressure01:.8,uncertainty01:.55,predictionError01:.18,horizon:7});
  const next=latent.map((v,i)=>Math.max(0,Math.min(1,v+(i%4===0?.11:i%4===1?-.06:0))));
  g.afterOutcome({tick:t,latent,nextLatent:next,action:A[t%A.length],reward01:t%6===0?.88:.62,predictionError01:.12,verified01:.9});
}
let transferred=0;
for(let t=1;t<=160;t++){
  const latent=Array.from({length:32},(_,i)=>((i*5+t*2+9)%37)/36);
  const r=g.beforeDecision({tick:500+t,latent,baseUtilities:base,goalPressure01:.8,uncertainty01:.6,predictionError01:.25,horizon:7});
  if(r.counterfactualUse01>.05) transferred++;
}
const gd=g.diagnostics();
assert(gd.prototypeCoverage01>0,'B2521 prototype transfer remained unused');
assert(gd.modelCoverage01>0.20,`B2521 coverage remained low: ${gd.modelCoverage01}`);
console.log('B2587_2598_HORIZON_TRANSFER_PASS',JSON.stringify({horizonDepth:bm.horizonDepth,horizonErrors:bm.horizonErrors,horizonConfidence01:bm.horizonConfidence01,longHorizonSamples:[bm.horizonCounts[3],bm.horizonCounts[4]],b2521ModelCoverage01:gd.modelCoverage01,prototypeCoverage01:gd.prototypeCoverage01,globalCoverage01:gd.globalCoverage01,transitionsTransferred:gd.transitionsTransferred,counterfactualUse01:gd.counterfactualUse01,probeWindows:transferred},null,2));
