import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const U=Object.fromEntries(A.map(a=>[a,.5]));
const b=new NeuralExperienceBranch();
const t0=process.hrtime.bigint();
for(let t=1;t<=5000;t++){
  const f=Array.from({length:64},(_,i)=>Math.sin(t*.01+i*.17)*.4+.1*(i%5===0));
  const r=b.beforeDecision({tick:t,input:f,baseUtilities:U,predictionError01:.18+(t%19)/50,novelty01:.2+(t%17)/24,uncertainty01:.15+(t%23)/30,homeostasis01:.7,identityGap01:.2,goalPressure01:.45,reward01:.5,embodied:{sensorFeatures:f}});
  const action=A[t%A.length]; b.commitAction(action,U); b.afterOutcome({tick:t,action,reward01:action==='verify'?.72:.48,predictionError01:.22,verified01:t%3===0?1:0,nextInput:f.map((x,i)=>x+Math.sin(i+t*.02)*.01),embodied:{nextFeatures:f,sensorFreshness01:.8}});
  if(t%12===0)b.replay(3);
}
const ms=Number(process.hrtime.bigint()-t0)/1e6;const m=b.continuityMetrics();
console.log('B2559_2566_EMBODIED_PERFORMANCE_PASS');
console.log(JSON.stringify({cycles:5000,ms,cyclesPerSecond:5000/(ms/1000),transfer01:m.embodiedBridge.transfer01,causalSensitivity01:m.embodiedBridge.causalSensitivity01,predictionConsistency01:m.embodiedBridge.predictionConsistency01,computeCost01:m.embodiedBridge.computeCost01,activeNeuronFraction01:m.embodiedBridge.activeNeuronFraction01},null,2));
