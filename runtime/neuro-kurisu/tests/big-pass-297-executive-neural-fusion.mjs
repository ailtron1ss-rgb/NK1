import { B297ExecutiveNeuralFusion } from '../src/organism/system/B297ExecutiveNeuralFusion.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const assert=(x,m)=>{if(!x)throw new Error(m)};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const sources=['self','personality','agency','predictive','homeostasis','causal','neural','kernel','social','resource'];
const q=new B297ExecutiveNeuralFusion();
let selected='wait';
for(let tick=1;tick<=1600;tick++){
  const good = tick%7===0 || tick%11===0;
  const bad = tick%13===0;
  const sourcesMap={};
  for(const s of sources){
    sourcesMap[s]={};
    for(const a of actions){
      const useful = a==='verify' ? .038 : a==='explore' ? -.012 : 0;
      const noise = bad && (s==='resource'||s==='social') ? -.045 : 0;
      const duplicate = (s==='personality'||s==='self') ? .082 : 0;
      sourcesMap[s][a]=useful+duplicate+noise+(s==='neural'&&good&&a==='verify'?.018:0);
    }
  }
  const r=q.fuse({
    tick,
    candidates:actions.map((action,i)=>({action,score:.42+((action==='verify'&&good)?.08:0)+(i===0?.01:0),predictedUtility:.45,confidence01:.72})),
    sources:sourcesMap,
    identity01:.84,personality01:.81,agency01:.76,goalPressure01:.60,uncertainty01:.34,novelty01:.41,energy01:.78,cognitiveCapacity01:.82,
    externalInput:tick%19===0,requestedAction:tick%19===0?'verify':null,facadeIdentity01:.83,facadeBudget01:.79,facadeAgency01:.75,
  });
  selected=r.selectedAction??'wait';
  if(tick%4===0){
    q.recordOutcome({tick,action:selected,reward01:selected==='verify'&&good?.82:bad?.31:.57,predictionError01:good?.18:bad?.62:.28,externalEvidence01:tick%19===0?1:0});
  }
}
const d=q.diagnostics();
const snap=q.snapshot();
assert(d.cycles===1600,'cycle count');
assert(d.outcomeUpdates===400,'outcome count');
assert(d.commits>0,'no commits');
assert(d.meanSourceReliability!==.5,'reliability never learned');
assert(d.redundantPairs.length>0,'redundancy tracker never detected duplicate signals');
assert(Object.values(snap.sourceReliability).every(Number.isFinite),'non-finite source reliability');
assert(snap.history.length<=128,'history not bounded');
const lesionInput={tick:1601,candidates:actions.map(a=>({action:a,score:.5,predictedUtility:.5,confidence01:.7})),sources:Object.fromEntries(sources.map(s=>[s,{verify:s==='neural'?.10:0}])),identity01:.8,personality01:.8,agency01:.8,goalPressure01:.6,uncertainty01:.3,novelty01:.4,energy01:.8,cognitiveCapacity01:.8,externalInput:false};
const beforeFrame=q.fuse(lesionInput).actions.find(x=>x.action==='verify');
q.lesion('neural');
const afterFrame=q.fuse({...lesionInput,tick:1602}).actions.find(x=>x.action==='verify');
q.clearLesions();
assert(beforeFrame&&afterFrame,'lesion test did not produce action frames');
assert(afterFrame.fusedSignal01 < beforeFrame.fusedSignal01,'neural lesion did not reduce fused neural influence');

console.log(JSON.stringify({pass:true,standalone:d,lesionBefore:beforeFrame,lesionAfter:afterFrame}));
