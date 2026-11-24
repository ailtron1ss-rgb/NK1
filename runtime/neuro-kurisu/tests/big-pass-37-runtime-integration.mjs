import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableWorldModel:true,enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
for(let i=0;i<80;i++){
  await core.observe({worldContext:{location:'integration',facts:[i%4?'stable':'new'],uncertainty:i%7===0?.72:.22},embodiment:{bodyEnergy01:.82-(i%20)*.006,cognitiveCapacity01:.88,thermalStrain01:.18,sensoryFreshness01:.9,awake:true}});
  await core.feedback({success:.55+(i%5)*.08,reward:.35+(i%6)*.09,surprise:i%9===0?.3:.08,worldTransition:{action:'observe',before:{tick:i,location:'integration',energy:.8,attention:.8,uncertainty:.3,facts:['stable'],objects:[],events:[]},after:{tick:i+1,location:'integration',energy:.79,attention:.8,uncertainty:.25,facts:[i%4?'stable':'new'],objects:[],events:[]},reward:.35+(i%6)*.09,surprise:i%9===0?.3:.08,at:Date.now()}});
}
const before=core.snapshot();
assert.ok(before.system.selfPredictionBenchmark?.samples>0);
assert.ok(before.system.modelOlympics?.rounds>0);
assert.ok(before.system.externalEvidenceTrust?.records.length>0);
assert.ok(before.facets.evolution.selfProjects.projects.every(p=>Array.isArray(p.milestones)));
await core.flush();
const loaded=await store.load();
assert.ok(loaded);
assert.ok(loaded.system.selfPredictionBenchmark?.samples>=before.system.selfPredictionBenchmark.samples);
assert.ok(loaded.system.modelOlympics?.rounds>=before.system.modelOlympics.rounds);
assert.ok(loaded.system.externalEvidenceTrust?.records.length>=before.system.externalEvidenceTrust.records.length);
console.log('BIG_PASS_37_RUNTIME_INTEGRATION=PASS', JSON.stringify({tick:loaded.state.tick,selfPredictionSamples:loaded.system.selfPredictionBenchmark.samples,modelOlympicsRounds:loaded.system.modelOlympics.rounds,evidenceRecords:loaded.system.externalEvidenceTrust.records.length}));
