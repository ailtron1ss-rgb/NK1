import assert from 'node:assert/strict';
import { B286SelfConflictContinuityCore } from '../src/organism/cognition/B286SelfConflictContinuityCore.ts';
const core=new B286SelfConflictContinuityCore();
for(let t=1;t<=300;t++){
  const relation=t<150?'alice':'mentor';
  const reward=t<100?.88:t<200?.38:.76;
  const goal=new Array(8).fill(0).map((_,i)=>((i%2===0)?1:-1)*(t<150?.8:1)*Math.sin(t*.03+i*.7));
  core.step({tick:t,identityLatent:new Array(24).fill(Math.sin(t*.02)),worldLatent:new Array(16).fill(Math.cos(t*.03)),goalVector:goal,memoryLatent:new Array(16).fill(Math.sin(t*.05)),personalityVector:new Array(24).fill(Math.cos(t*.011)),relationshipVector:new Array(24).fill(Math.sin(t*.013)),relationshipId:relation,reward01:reward,predictionError01:t%17===0?.55:.14,importance01:t%23===0?.9:.42,learningEnabled:true});
  if(t%24===0) core.replay(8);
}
const d=core.diagnostics();
assert(d.steps===300); assert(d.learningUpdates===300); assert(d.revisionCount>0); assert(d.relationCount>=2); assert(d.identityConflict01>=0); assert(d.valueIntegrity01>0);
const traits=Object.values(d.traitValues); const spread=Math.sqrt(traits.reduce((s,x)=>s+(x-traits.reduce((a,b)=>a+b,0)/traits.length)**2,0)/traits.length); assert(spread>0.01);
const ablation=core.identityAblation(d.futureIdentities?.[1]??new Array(24).fill(0)); assert(ablation>0.02);
const snap=core.snapshot(); const restored=new B286SelfConflictContinuityCore(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,replayUpdates:d.replayUpdates,revisionCount:d.revisionCount,relationCount:d.relationCount,identityConflict01:d.identityConflict01,valueIntegrity01:d.valueIntegrity01,selfContinuity01:d.selfContinuity01,futureCoherence01:d.futureCoherence01,traitSpread01:d.traitSpread01,ablationDrop01:ablation,restart:true}));
