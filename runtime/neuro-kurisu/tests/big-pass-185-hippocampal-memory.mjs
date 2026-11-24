import assert from 'node:assert/strict';
import { HippocampalMemorySubstrate } from '../src/organism/memory/HippocampalMemorySubstrate.ts';
import { defaultMemoryOS2, MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const mem=(id,content,kind='episodic',salience=.7,predictionError=.55)=>({
 id,content,kind,createdAt:1000,lastAccessAt:1000,salience,emotionalWeight:.35,identityRelevance:.4,goalRelevance:.55,socialRelevance:.2,predictionError,temperature01:.5,confidence:.8,epistemicStatus:'hypothesis',source:'test',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],revisionHistory:[],dormant:false,retrievalCount:0,semanticVector:[]
});

const h=new HippocampalMemorySubstrate({maxTraces:96,maxSchemas:12});
for(let i=0;i<48;i++) h.encode(mem(`m${i}`,i<24?'quantum memory research':'embodied autonomy research'),{centralLatent:Array.from({length:64},(_,j)=>Math.sin(i*.13+j*.07)),tick:i,at:1000+i});
assert.equal(h.diagnostics().encodingCount,48);
assert.equal(h.diagnostics().traceCount,48);
const q1=h.recallFeatures('quantum memory research',1050);
assert(q1.some(Number.isFinite));
const cons=h.consolidate(12,64,1064);
assert(cons.replayed>0 && cons.updated>0 && cons.schemas>0);
const q2=h.recall('quantum memory research',4,1060);
assert(q2.episodes.length>0);
assert(q2.schema!==null);
const snap=h.snapshot();
const restored=new HippocampalMemorySubstrate({maxTraces:96,maxSchemas:12});
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap,'hippocampal substrate restore must be exact');

// Compatibility: it must be possible to source traces from canonical MemoryOS2 without replacing it.
const os=new MemoryOS2();
os.restore(defaultMemoryOS2());
const encoded=os.encode({...mem('canonical','canonical memory source')});
h.encode(encoded,{centralLatent:new Array(64).fill(.1),tick:100,at:1100});
assert.equal(h.diagnostics().encodingCount,49);

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const wc=(tick)=>({tick,location:'b3-lab',energy:.86,attention:.81,uncertainty:.2,facts:['episodic-memory','consolidation'],objects:[],events:['memory-event']});
for(let i=0;i<8;i++){
  await core.observe({text:i%2?'quantum memory research':'embodied autonomy research',novelty:.58,worldContext:wc(i)});
  await core.feedback({success:i%3===0?.74:.69,reward:.71,surprise:.13,worldTransition:{action:'explore',before:wc(i),after:wc(i+1),reward:.71,surprise:.13,at:30000+i}});
}
const coreSnap=core.snapshot();
assert((coreSnap.facets.advanced.hippocampal?.encodingCount??0)>=8,'core must encode live memories into hippocampal substrate');
const coreHip=(core).memorySubsystem.hippocampal;
const coreConsolidation=coreHip.consolidate(8,64,40000);
assert(coreConsolidation.replayed>=1,'core hippocampal state must support replay from live encoded memories');
assert(coreConsolidation.updated>=1,'core hippocampal state must support slow schema learning');
assert((coreSnap.facets.cognition.centralBrain?.stepCount??0)>=8,'central brain must remain live through hippocampal integration');

console.log(JSON.stringify({pass:185,diagnostics:h.diagnostics(),core:{hippocampal:coreSnap.facets.advanced.hippocampal,centralBrain:{stepCount:coreSnap.facets.cognition.centralBrain?.stepCount,learningSteps:coreSnap.facets.cognition.centralBrain?.learningSteps}}},null,2));
