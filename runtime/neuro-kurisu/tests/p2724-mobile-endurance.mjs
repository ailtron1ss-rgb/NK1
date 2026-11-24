import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.31+i*.044]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>Math.sin((k+task*3)*.071+t*.019)*.40+Math.cos(k*.037+task)*.07);
const heap=()=>process.memoryUsage().heapUsed/1024/1024;
const b=new NeuralExperienceBranch();
const startHeap=heap();
const start=performance.now();
let maxHeap=startHeap;
for(let t=0;t<420;t++){
  const task=(Math.floor(t/70)+t%3)%4;
  const low=t%29===0;
  const r=b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:utilities,predictionError01:.16+.08*(task%3),novelty01:task===3?.58:.22,uncertainty01:low?.58:.27,homeostasis01:.45,identityGap01:.18,goalPressure01:.4,reward01:.56,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.09+t*.01)+task*.2),embodied:{cpuLoad01:low?.92:.32,ramPressure01:low?.88:.28,battery01:low?.20:.86,sensorFreshness01:low?.70:.97}});
  b.afterOutcome({tick:t+1,action:task===2?'verify':task===1?'explore':'respond',reward01:task===2?.82:task===1?.79:.84,predictionError01:task===2?.22:.13,verified01:.95,nextInput:vec(task,t+1),holdout01:t%7===0?1:0,goalPressure01:.4,identityGap01:.18});
  if(t%20===0){const h=heap();if(h>maxHeap)maxHeap=h;}
}
const elapsed=performance.now()-start;
const beforeRestart=b.diagnostics();
const resumed=new NeuralExperienceBranch();
resumed.restore(beforeRestart);
for(let t=420;t<500;t++){
  const task=t%4;
  const r=resumed.beforeDecision({tick:t,input:vec(task,t),baseUtilities:utilities,predictionError01:.18,novelty01:.35,uncertainty01:.30,homeostasis01:.45,identityGap01:.18,goalPressure01:.4,reward01:.56,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.09+t*.01)+task*.2),embodied:{cpuLoad01:.45,ramPressure01:.35,battery01:.8,sensorFreshness01:.97}});
  resumed.afterOutcome({tick:t+1,action:task===2?'verify':task===1?'explore':'respond',reward01:.80,predictionError01:.18,verified01:.92,nextInput:vec(task,t+1),holdout01:t%9===0?1:0,goalPressure01:.4,identityGap01:.18});
}
for(let t=500;t<1500;t++){
  resumed.microTick({tick:t,input:vec(t%4,t),action:t%2?'explore':'respond',reward01:.72,predictionError01:.24,verified01:.90,novelty01:.24,uncertainty01:.30,goalPressure01:.40,identityGap01:.18,worldConfidence01:.70,selfContinuity01:.82});
}
const after=resumed.diagnostics();
const endHeap=heap();
const heapGrowth=Math.max(0,endHeap-startHeap);
const maxGrowth=Math.max(0,maxHeap-startHeap);
assert.equal(after.version,25);
assert.ok(after.autonomousContinual.outcomes>=740);
assert.ok(Number.isFinite(elapsed) && Number.isFinite(endHeap));
assert.ok(after.autonomousContinual.replay.length<=96);
assert.ok(after.autonomousContinual.mobilePressure01>=0&&after.autonomousContinual.mobilePressure01<=1);
assert.ok(heapGrowth<650,'unexpectedly large host heap growth during endurance run');
console.log(`P2724_MOBILE_ENDURANCE=PASS cycles=1500 outcomes=${after.autonomousContinual.outcomes} elapsedMs=${elapsed.toFixed(1)} startHeapMB=${startHeap.toFixed(1)} maxHeapMB=${maxHeap.toFixed(1)} endHeapMB=${endHeap.toFixed(1)} maxGrowthMB=${maxGrowth.toFixed(1)} endGrowthMB=${heapGrowth.toFixed(1)} replay=${after.autonomousContinual.replay.length} replayUsed=${after.autonomousContinual.replayUsed} mobilePressure=${after.autonomousContinual.mobilePressure01.toFixed(4)} hotResidency=${after.autonomousContinual.hotResidency01.toFixed(4)} restartOk=1`);
