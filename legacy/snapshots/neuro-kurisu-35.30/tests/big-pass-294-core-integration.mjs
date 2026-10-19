import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const r=new OrganismRuntime({stateFile:'b294-test.json',worldStateFile:'b294-world.json',enableLanguage:false,performanceProfile:'balanced',stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal()});
await r.init();
for(let i=0;i<24;i++){ await r.step(i%3===0?'Continue the current internal objective; verify uncertainty before changing it.':undefined); }
const d=r.core.b294CausalNeuralEventDiagnostics();
assert(d.decisionCount>0,'B294 decision events integrated');
const before=r.core.b294CausalNeuralEventDiagnostics().causalConfidence01;
r.core.b294CausalNeuralEventLesion(.8); const lesioned=r.core.b294CausalNeuralEventDiagnostics(); r.core.b294CausalNeuralEventClearLesion();
const snap=r.core.b294CausalNeuralEventSnapshot();
assert(snap.records.length<=192,'bounded core B294 records');
assert(lesioned.lesion01>.7,'B294 lesion persisted');
console.log(JSON.stringify({pass:true,ticks:24,decisionCount:d.decisionCount,outcomeCount:d.outcomeCount,learningUpdates:d.learningUpdates,causalConfidence01:d.causalConfidence01,lesionState:lesioned.lesion01,boundedRecords:snap.records.length},null,2));
r.stop();
