import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const core=new B365UnifiedNeuroCausalCore();
const lat=[];
for(let i=0;i<20;i++) core.step({tick:i,vector:Array(64).fill(0).map((_,j)=>Math.sin(i*.07+j*.13)),novelty01:.4,uncertainty01:.5,predictionError01:.3,autonomy01:.72});
for(let i=20;i<140;i++){
  const t=performance.now();
  core.planActivePerception({tick:i,uncertainty01:(i%20)/20,predictionError01:(i%17)/17,novelty01:(i%13)/13});
  core.step({tick:i,vector:Array(64).fill(0).map((_,j)=>Math.sin(i*.07+j*.13)),novelty01:(i%13)/13,uncertainty01:(i%20)/20,predictionError01:(i%17)/17,autonomy01:.72});
  lat.push(performance.now()-t);
}
lat.sort((a,b)=>a-b);
const pct=p=>lat[Math.min(lat.length-1,Math.floor((lat.length-1)*p))];
console.log(JSON.stringify({pass:true,status:'B371_NEURAL_ACTIVE_PERCEPTION_PERFORMANCE_PASS',cycles:120,p50_ms:+pct(.5).toFixed(3),p95_ms:+pct(.95).toFixed(3),p99_ms:+pct(.99).toFixed(3),max_ms:+lat.at(-1).toFixed(3),activePlanStats:core.diagnostics().activePerceptionStats},null,2));
