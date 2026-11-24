import assert from 'node:assert/strict';
import { B2525LearnedLatentTransitionField } from '../src/organism/cognition/B2525LearnedLatentTransitionField.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=t=>Array.from({length:32},(_,i)=>((i*17+t*11)%113)/112);
const m=new B2525LearnedLatentTransitionField();
for(let t=1;t<=900;t++){
 const pre=ctx(t%41); const r=m.beforeDecision({tick:t,context:pre,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:t%19===0?.82:.28,novelty01:t%13===0?.84:.2,predictionError01:t%23===0?.7:.2,computeBudget01:.86});
 const a=actions.slice().sort((x,y)=>(r.actionBias[y]??0)-(r.actionBias[x]??0))[0];
 const post=pre.map((v,k)=>Math.max(0,Math.min(1,v+(a==='explore'?.04:a==='verify'?.025:.008)*(k%3===0?1:-.35)+(t%37===0?.01:0))));
 const reward=a==='explore'&&t%13===0?.9:(a==='verify'&&t%19===0?.86:.55);
 m.afterOutcome({tick:t,preContext:pre,postContext:post,action:a,reward01:reward,predictionError01:Math.abs(reward-.55)});
}
const d=m.diagnostics();
assert.equal(d.writes,900); assert(d.prototypes.length>0); assert(d.queries===900); assert(d.transitionConfidence01>0); assert(d.learningGain01>0); assert(d.experiments>0); assert(d.experimentUseful>=0);
const lesion=m.lesion(.65); assert(lesion.causalDrop01>=0);
const snap=m.snapshot(),m2=new B2525LearnedLatentTransitionField();m2.restore(snap);assert.deepEqual(m2.snapshot(),snap);
const runtime=new OrganismRuntime({stateStore:new MemoryStateStore(),stateFile:'/tmp/nk-p2679.json',enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'operational',performanceProfile:'mobile'});await runtime.init();
for(let i=0;i<10;i++) await runtime.autonomousStep({novelty:i%5===0?.78:.22,uncertainty:i%7===0?.8:.3,reward:i%11===0?.35:.74,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.82,thermalStrain01:.15,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.24,ramPressure01:.21}});
const rd=runtime.core.b2525LearnedLatentTransitionFieldDiagnostics();assert(rd.writes>0);assert(runtime.core.snapshot().system.b2525LearnedLatentTransitionField);runtime.stop();
console.log(JSON.stringify({standalone:{writes:d.writes,queries:d.queries,prototypes:d.prototypes.length,transitionHits:d.transitionHits,confidence:d.transitionConfidence01,shift:d.distributionShift01,experiments:d.experiments,useful:d.experimentUseful,learningGain:d.learningGain01,lesion},integrated:{writes:rd.writes,queries:rd.queries,prototypes:rd.prototypes.length,confidence:rd.transitionConfidence01,shift:rd.distributionShift01}}));
