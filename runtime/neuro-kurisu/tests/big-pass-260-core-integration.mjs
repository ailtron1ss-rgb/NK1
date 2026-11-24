import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

function store(){ let value=null; return { async load(){return value?structuredClone(value):null;}, async save(v){value=structuredClone(v);}, metrics(){return {saves:0,bytesWritten:0,lastPayloadBytes:0,lastSaveMs:0,backupCopies:0,fsyncs:0,lastSavedAt:0};} }; }
const s=store();
const core=new OrganismCore(s,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
await core.init();
for(let i=0;i<18;i++){
  await core.observe({novelty:i%5===0?0.8:0.2,surprise:i%4===0?0.55:0.1,text:i%7===0?`memory event ${i}`:undefined},'operational');
  await core.feedback({success:i%2===0?.8:.25,reward:i%2===0?.75:.1,surprise:i%5===0?.7:.12});
}
const snap=core.snapshot();
const rcm=snap.system.recurrentCausalMemory;
assert.ok((rcm?.encodingCount??0)>=18);
assert.ok((rcm?.outcomeCount??0)>=18);
assert.ok((rcm?.replayRuns??0)>=1,'integration must trigger recurrent replay');
assert.ok((rcm?.replayedEpisodes??0)>0,'integration must replay episodes');
assert.ok((rcm?.delayedCredit01??0)>=0,'diagnostic must exist'); assert.ok((rcm?.linkedMemoryIds?.length??0)>0,'recurrent causal memory must link to hippocampal-compatible memory ids');
const s2=store();
await s2.save(snap);
const core2=new OrganismCore(s2,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
await core2.init();
assert.deepEqual(core2.snapshot().system.recurrentCausalMemory,rcm,'B260 system state must survive core restart round-trip');
const r=core2.snapshot().system.recurrentCausalMemory; console.log(JSON.stringify({ok:true,encodingCount:r?.encodingCount,outcomeCount:r?.outcomeCount,replayRuns:r?.replayRuns,replayedEpisodes:r?.replayedEpisodes,delayedCredit01:r?.delayedCredit01,linkedMemoryCount:r?.linkedMemoryIds?.length??0,canonicalLearning:core2.snapshot().system.canonicalNeuralSubstrate?.learningUpdates??0}));
