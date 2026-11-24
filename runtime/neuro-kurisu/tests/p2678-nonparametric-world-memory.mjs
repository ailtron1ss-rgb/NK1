import assert from 'node:assert/strict';
import { B2524NonparametricWorldExperienceMemory } from '../src/organism/cognition/B2524NonparametricWorldExperienceMemory.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=t=>Array.from({length:32},(_,i)=>((i*13+t*7)%101)/100);
const m=new B2524NonparametricWorldExperienceMemory();
let first=0,last=0;
for(let t=1;t<=600;t++){
 const c=ctx(t%97); const r=m.beforeDecision({tick:t,context:c,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:t%17===0?.8:.25,novelty01:t%11===0?.8:.2,computeBudget01:.85});
 const a=actions.slice().sort((x,y)=>(r.actionBias[y]??0)-(r.actionBias[x]??0))[0];
 const reward=a==='verify'&&t%19===0?.92:(a==='explore'&&t%11===0?.84:.55);
 m.afterOutcome({tick:t,context:c,action:a,reward01:reward,predictionError01:1-reward});
 if(t===20)first=r.predictionConfidence01; if(t===1200)last=r.predictionConfidence01;
}
const d=m.diagnostics();
assert.equal(d.writes,600);assert(d.prototypes.length>0);assert(d.queries===600);assert(d.hits>0);assert(d.predictionConfidence01>0);assert(d.learningGain01>0);
const s=m.snapshot(),m2=new B2524NonparametricWorldExperienceMemory();m2.restore(s);assert.deepEqual(m2.snapshot(),s);
const runtime=new OrganismRuntime({stateStore:new MemoryStateStore(),stateFile:'/tmp/nk-p2678.json',enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'operational',performanceProfile:'mobile'});await runtime.init();
for(let i=0;i<6;i++) await runtime.autonomousStep({novelty:i%9===0?.72:.22,uncertainty:i%11===0?.78:.28,reward:i%17===0?.35:.74,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.82,thermalStrain01:.15,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.24,ramPressure01:.21}});
const rd=runtime.core.b2524NonparametricWorldExperienceMemoryDiagnostics();assert(rd.writes>0);assert(rd.prototypes.length>0);assert(runtime.core.snapshot().system.b2524NonparametricWorldExperienceMemory);await runtime.stop();
console.log(JSON.stringify({standalone:{writes:d.writes,queries:d.queries,hits:d.hits,prototypes:d.prototypes.length,predictionConfidence01:d.predictionConfidence01,novelty01:d.novelty01,learningGain01:d.learningGain01},integrated:{writes:rd.writes,queries:rd.queries,prototypes:rd.prototypes.length,predictionConfidence01:rd.predictionConfidence01}}));
