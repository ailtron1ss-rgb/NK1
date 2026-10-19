import assert from 'node:assert/strict';
import { B1351B1600LifelongDevelopmentCore } from '../src/organism/system/B1351B1600LifelongDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const choose=o=>A.reduce((b,a)=>o.actionBias[a]>(o.actionBias[b]??-1)?a:b,A[0]);
const ctx=(seed)=>Array.from({length:48},(_,i)=>((Math.sin(seed*.37+i*.17)+1)/2));
const run=({ticks=6000,reversalAt=3600}={})=>{
  const c=new B1351B1600LifelongDevelopmentCore(); let hitsA=0,hitsB=0,hitsAfter=0,totalAfter=0;
  for(let t=0;t<ticks;t++){
    const task=t%2, context=ctx(task?2:1);
    const target=t<reversalAt ? (task?'explore':'respond') : (task?'verify':'explore');
    const d=c.beforeDecision({tick:t,context01:context,baseUtilities:base,uncertainty01:t%97===0?.78:.18,predictionError01:t%113===0?.72:.06,novelty01:t%89===0?.77:.08,confidence01:.72,goalVector:context,selfVector:context,complexity01:t%71===0?.66:.24,worldModel01:dummy(),neuralPlasticity01:.68});
    const action=choose(d); const success=action===target?1:0;
    if(t<reversalAt && task===0)hitsA+=success; if(t<reversalAt&&task===1)hitsB+=success; if(t>=reversalAt){hitsAfter+=success;totalAfter++;}
    c.afterOutcome({tick:t,action,context01:context,nextContext01:ctx(task?2.1:1.1),reward01:success?0.96:.08,predictionError01:success?.04:.84,success01:success,verified01:success?1:.75});
  }
  return {c,hitsA:Math.round(hitsA/(reversalAt/2)*1000)/10,hitsB:Math.round(hitsB/(reversalAt/2)*1000)/10,after:Math.round(hitsAfter/Math.max(1,totalAfter)*1000)/10};
};
function dummy(){return .66;}
const {c,hitsA,hitsB,after}=run();
const d=c.diagnostics();
assert(d.decisions>=6000); assert(d.updates>=6000); assert(d.sleepCycles>=1); assert(d.consolidationEvents>0); assert(d.replays>0); assert(d.skillUpdates>0); assert(d.causalUpdates>0); assert(d.neuralUpdates>0); assert(d.longHorizonChecks>0); assert(d.curriculumSelections>0);
const snap=c.snapshot(); const r=new B1351B1600LifelongDevelopmentCore(); r.restore(snap); const rd=r.diagnostics(); assert.equal(rd.updates,d.updates); assert.equal(rd.decisions,d.decisions);
const probe={tick:9000,context01:ctx(1),baseUtilities:base,uncertainty01:.71,predictionError01:.65,novelty01:.69,confidence01:.62,goalVector:ctx(1),selfVector:ctx(1),complexity01:.72};
const baseline=c.beforeDecision(probe);
r.restore(snap); r.setLesions({'sleep-consolidation':true,'causal-credit':true,'identity':true,'curriculum':true}); const les=r.beforeDecision(probe);
const lesionEffect=A.reduce((s,a)=>s+Math.abs((baseline.actionBias[a]??0)-(les.actionBias[a]??0)),0)/A.length;
console.log('B1351_B1600_LIFELONG_PASS');
console.log(JSON.stringify({
  preReversalTaskA:hitsA,preReversalTaskB:hitsB,postReversal:after,decisions:d.decisions,updates:d.updates,
  sleepCycles:d.sleepCycles,replays:d.replays,consolidationEvents:d.consolidationEvents,skillUpdates:d.skillUpdates,
  taskTransfers:d.taskTransfers,causalUpdates:d.causalUpdates,worldUpdates:d.worldUpdates,neuralUpdates:d.neuralUpdates,
  curriculumSelections:d.curriculumSelections,longHorizonChecks:d.longHorizonChecks,identityChecks:d.identityChecks,
  lesionEffect,restartPersistence:true
},null,2));
