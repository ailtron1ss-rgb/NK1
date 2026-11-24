import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const r=new OrganismRuntime({stateFile:'b297-test.json',worldStateFile:'b297-world.json',enableLanguage:false,performanceProfile:'mobile',stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal()});
await r.init();
for(let i=0;i<12;i++){
  await r.step(i%4===0?'Verify the current objective before changing it.':undefined);
  if(i%2===1) await r.core.feedback({success:i%4===1?.82:.34,reward:i%4===1?.78:.3,surprise:i%3===0?.58:.22,evidenceSource:'external-observation'});
}
const d=r.core.b297ExecutiveNeuralFusionDiagnostics();
const s=r.core.b297ExecutiveNeuralFusionSnapshot();
assert(d.cycles>0,'B297 did not enter OrganismCore');
assert(d.outcomeUpdates>0,'B297 core outcome learning did not execute');
assert(s.lastFrame.length>0,'B297 frame empty');
assert(r.core.snapshot().system.executiveNeuralFusionB297,'B297 persistence missing');
const lesion=r.core.b297ExecutiveNeuralFusionLesion('neural');
assert(lesion.lesioned,'B297 lesion did not activate');
r.core.b297ExecutiveNeuralFusionClearLesions();
console.log(JSON.stringify({pass:true,d}));
r.stop();
