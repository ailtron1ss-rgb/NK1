import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const store=new MemoryStateStore();
const core=new OrganismCore(store,cfg);
await core.init();

await core.observe({text:'red lamp in the lab',worldContext:{location:'lab',facts:['red lamp is usually near the bench'],objects:[{id:'lamp',label:'red lamp',visible:true}]},novelty:.75,reward:.72,success:.7});
await core.feedback({success:.74,reward:.76,evidenceSource:'world-memory-test'});
for(let i=0;i<6;i++){
  await core.observe({text:'red lamp lab',worldContext:{location:'lab',facts:['bench and red lamp'],objects:[{id:'lamp',label:'red lamp',visible:true}]},novelty:.62,reward:.68,success:.66});
  await core.feedback({success:.69,reward:.71,evidenceSource:'world-memory-test'});
}

const bridge=core.memoryWorldCausalBridgeSnapshot();
assert.ok(bridge.applications>=1,'memory-world applications');
assert.ok(bridge.verifiedLinks>=1,'at least one verified causal memory-world link');
const verified=bridge.recent.find(x=>x.status==='verified');
assert.ok(verified,'verified link present');
assert.ok(verified.memoryIds.length>0,'verified link carries memory ids');
assert.ok(verified.delta01>=.015,'verified link has material counterfactual delta');
const world=core.worldPredictionEvidenceSnapshot();
const latent=world.worldModel2?.latentState;
assert.ok(latent?.provenanceIds?.some(x=>x.startsWith('memory:')),'world latent contains memory provenance');
const closure=core.cognitiveDomainClosureSnapshot();
assert.ok(closure.last,'closure record present');
assert.equal(closure.last.links.memoryToWorld,true,'closure must use causal memory-world evidence');
const before=JSON.stringify({bridge,world:core.worldPredictionEvidenceSnapshot(),closure});
const restored=new OrganismCore(store,cfg);
await restored.init();
assert.equal(JSON.stringify(restored.memoryWorldCausalBridgeSnapshot()),JSON.stringify(bridge),'bridge survives restart');
assert.equal(JSON.stringify(restored.cognitiveDomainClosureSnapshot()),JSON.stringify(closure),'closure survives restart');
assert.ok(restored.worldPredictionEvidenceSnapshot().worldModel2.latentState.provenanceIds.some(x=>x.startsWith('memory:')),'world memory provenance survives restart');
console.log('BIG_PASS_205_MEMORY_WORLD_CAUSAL=PASS',JSON.stringify({applications:bridge.applications,verifiedLinks:bridge.verifiedLinks,lastVerifiedTick:bridge.lastVerifiedTick,influence01:verified.influence01,delta01:verified.delta01,closureMemoryToWorld:closure.last.links.memoryToWorld,restore:'PASS'}));
