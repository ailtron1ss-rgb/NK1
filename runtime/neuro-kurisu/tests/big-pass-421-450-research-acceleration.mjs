import assert from 'node:assert/strict';
import { B421B450ResearchAccelerationCore } from '../src/organism/system/B421B450ResearchAccelerationCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map(a=>[a,.5]));
const ctx=i=>Array.from({length:8},(_,j)=>((i*3+j*7)%17)/16);
const core=new B421B450ResearchAccelerationCore();
let maxLatency=0;
const t0=performance.now();
for(let i=0;i<160;i++){
  const c=ctx(i);
  const start=performance.now();
  const out=core.beforeDecision({tick:i,context01:c,baseUtilities:{...base,respond:i%7===0?.82:.44,explore:i%11===0?.79:.46},baseProbabilities:base,reward01:i%5===0?.8:.45,surprise01:i%9===0?.75:.2,novelty01:(i%13)/13,uncertainty01:(12-(i%13))/12,predictionError01:i%7/7,goalVector:c.slice().reverse(),selfVector:c,motivation01:.6,complexity01:i%6/6,memoryStrength01:.5});
  const latency=performance.now()-start;maxLatency=Math.max(maxLatency,latency);
  core.afterOutcome({tick:i,action:actions[i%actions.length],context01:c,nextContext01:ctx(i+1),reward01:i%7===0?.82:.45,surprise01:i%9===0?.75:.2,verified01:i%3?0:1,salience01:.5,predictionError01:.2,goal01:.6,complexity01:.4,success01:i%7===0?.9:.4});
  assert(out.predictiveUtility && out.strategy && Number.isFinite(out.confidence01));
}
const snap=core.snapshot();
const lesion=core.evaluateLesion({tick:999,context01:ctx(999),baseUtilities:base,baseProbabilities:base,reward01:.5,surprise01:.6,novelty01:.7,uncertainty01:.7,predictionError01:.6,goalVector:ctx(9),selfVector:ctx(8),motivation01:.7,complexity01:.8},{'causal-graph':true,'procedural-refiner':true,'meta-router':true,'hierarchical-world':true,'coordinated-rollout':true});
assert(lesion.delta01>0.0001,'aggregate lesion should have causal effect');
core.restore(snap); core.markRestart(); const restart=core.snapshot();
assert.equal(restart.episodes.length,snap.episodes.length);
const elapsed=performance.now()-t0;
console.log(JSON.stringify({pass:true,decisions:restart.diagnostics.decisions,episodes:restart.episodes.length,procedures:restart.procedures.length,edges:restart.edges.length,causalKnockout01:lesion.delta01,maxDecisionLatencyMs:Number(maxLatency.toFixed(4)),avgLoopMs:Number((elapsed/160/2).toFixed(4)),bestStrategy:restart.diagnostics.bestStrategy,developmentalGain01:restart.diagnostics.developmentalGain01},null,2));
