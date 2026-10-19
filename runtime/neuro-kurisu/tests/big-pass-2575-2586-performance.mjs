import assert from 'node:assert/strict';
import { AdaptiveCausalMemoryPlanner } from '../src/organism/cognition/AdaptiveCausalMemoryPlanner.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(a=>[a,.5]));
const context=Array.from({length:12},(_,i)=>Math.sin(i*.17)*.2+i*.013);
const latent=context.slice(0,8);
const p=new AdaptiveCausalMemoryPlanner();
const started=process.hrtime.bigint();
for(let t=1;t<=12000;t++){
  const a=actions[t%actions.length];
  p.beforeDecision({tick:t,context,latent,actionUtilities:utilities,forecast:[latent,latent,latent],forecastConfidence01:.86,disagreement01:.12,epistemicValue01:.4,computeBudget01:.75,retrieved:[],novelty01:(t%29)/28,uncertainty01:(t%31)/30,predictionError01:(t%17)/16,goalPressure01:.4});
  p.afterOutcome({tick:t,context,latent,nextLatent:latent.map((v,i)=>v+(i%2?.006:-.006)),action:a,reward01:a==='explore'?.72:.5,predictionError01:.18,verified01:t%7===0?1:.4,retrievedMemoryIds:[],counterfactualReward:new Array(7).fill(.5),forecastConfidence01:.86,disagreement01:.12});
  if(t%16===0)p.dreamRehearse(4);
}
const seconds=Number(process.hrtime.bigint()-started)/1e9;
const m=p.metrics();
assert.ok(m.dreamUpdates>0);
assert.ok(Number.isFinite(seconds)&&seconds>0);
console.log('B2575_2586_PERFORMANCE_PASS');
console.log(JSON.stringify({cycles:12000,seconds,cps:12000/seconds,dreamUpdates:m.dreamUpdates,dreamRehearsalCount:m.dreamRehearsalCount,forgettingDebt01:m.forgettingDebt01,ruleCount:m.ruleCount,traceCount:m.traceCount},null,2));
