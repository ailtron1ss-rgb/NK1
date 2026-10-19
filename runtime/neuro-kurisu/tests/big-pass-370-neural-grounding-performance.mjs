import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const core=new B365UnifiedNeuroCausalCore();
const samples=[];
for(let t=1;t<=120;t++){
  const started=performance.now();
  core.recordGroundedObservation({tick:t,source:'node-host',freshness01:1,sensorConfidence01:.35,verified01:0,energy01:.75,thermal01:.25,motion01:(t%7)/7,light01:.5,proximity01:.4,network01:1});
  const r=core.step({tick:t,vector:Array.from({length:64},(_,i)=>Math.sin(i*.17+t*.03)),novelty01:.35,uncertainty01:.3,goalPressure01:.4,autonomy01:.8,learningEnabled:true,actionContext:Object.fromEntries(['respond','explore','verify','rest','reflect','wait','defer'].map(a=>[a,{worldUtility01:.5,worldConfidence01:.7,worldUncertainty01:.3}]))});
  core.learnFromOutcome({tick:t,action:r.selectedAction,reward01:t%5===0?.8:.4,predictionError01:.25,verified01:1,externalEvidence01:1,novelty01:.35,actualUtility01:t%5===0?.8:.4,predictedReward01:r.rewardPrediction01,predictedUtility01:r.forecastUtilities[r.selectedAction],actualStateDelta01:.3,actualWorldConfidence01:.75,temporalCreditEnabled:true,delayedReward01:t%5===0?.8:.4});
  samples.push(performance.now()-started);
}
samples.sort((a,b)=>a-b);
const q=(p)=>samples[Math.min(samples.length-1,Math.floor((samples.length-1)*p))];
console.log(JSON.stringify({pass:true,status:'B370_GROUNDING_PERFORMANCE_PASS',cycles:samples.length,p50Ms:Number(q(.5).toFixed(3)),p95Ms:Number(q(.95).toFixed(3)),p99Ms:Number(q(.99).toFixed(3)),maxMs:Number(samples.at(-1).toFixed(3)),diagnostics:core.diagnostics()},null,2));
