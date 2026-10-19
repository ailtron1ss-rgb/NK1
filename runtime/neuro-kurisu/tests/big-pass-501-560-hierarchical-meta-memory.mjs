import assert from 'node:assert/strict';
import { B501B560HierarchicalMetaMemoryCore } from '../src/organism/system/B501B560HierarchicalMetaMemoryCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const ctx=i=>Array.from({length:8},(_,j)=>(((i+3)*(j+5)+j*j)%31)/30);
const input=(tick,x,over={})=>({tick,context01:x,actionUtilities:base,uncertainty01:over.uncertainty??.58,predictionError01:over.error??.28,novelty01:over.novelty??.46,surprise01:over.surprise??.30,confidence01:over.confidence??.54,goalVector:x,selfVector:x,motivation01:.56,complexity01:over.complexity??.45});
const C=new B501B560HierarchicalMetaMemoryCore();
for(let e=0;e<160;e++){
  const x=ctx(e%11), action=A[e%A.length], o=C.beforeDecision(input(e,x,{uncertainty:e%12===0?.96:.30+(e%7)*.07,predictionError:e%9===0?.78:.18,novelty:e%10===0?.92:.22,confidence:e%12===0?.18:.54}));
  C.afterOutcome({tick:e,action,context01:x,nextContext01:ctx((e+1)%11),reward01:e%9===0?.22:.86,predictionError01:e%9===0?.68:.12,verified01:e%9===0?0:1,success01:e%9===0?.20:.9,strategy:o.strategy,confidenceBefore01:o.calibratedConfidence01});
}
const d=C.diagnostics();
assert(d.decisions===160); assert(d.updates===160); assert(d.retrievals>0); assert(d.consolidations>0); assert(d.strategySwitches>0); assert(d.counterfactuals>0); assert(d.experiments>=0);
const probe=input(999,[.93,.11,.84,.24,.72,.37,.88,.66],{uncertainty:.81,predictionError:.71,novelty:.77,surprise:.72,confidence:.36,complexity:.82});
const lesion=C.evaluateLesion(probe,{'hierarchical-memory':true,'meta-router':true,'world-counterfactual':true});
assert(lesion.delta01>0.0001);
const snap=C.snapshot(); const C2=new B501B560HierarchicalMetaMemoryCore(); C2.restore(snap); C2.markRestart(); assert.equal(C2.diagnostics().updates,d.updates);
const after=C2.beforeDecision(probe); assert(Number.isFinite(after.computeBudget01)); assert(after.computeBudget01>0);
console.log(JSON.stringify({pass:true,status:'B501_B560_CORE_PASS',decisions:d.decisions,updates:d.updates,retrievals:d.retrievals,consolidations:d.consolidations,experiments:d.experiments,counterfactuals:d.counterfactuals,strategySwitches:d.strategySwitches,multiLesion01:Number(lesion.delta01.toFixed(6)),holdoutScore01:d.holdoutScore01,restartPersistence:true,lastStrategy:after.strategy,computeBudget01:Number(after.computeBudget01.toFixed(4))},null,2));
