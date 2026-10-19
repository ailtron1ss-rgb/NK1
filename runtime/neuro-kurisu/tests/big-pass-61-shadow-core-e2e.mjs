import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableWorldModel:true,enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
for(let i=0;i<48;i++){
  await core.observe({
    text:i%9===0?'проанализируй неопределённость':undefined,
    surprise:i%7===0?.7:.08,
    novelty:i%5===0?.68:.14,
    success:i%11===0?.35:undefined,
    worldContext:{location:i%4<2?'lab':'room',facts:[i%6<3?'stable':'shift'],uncertainty:i%6===0?.72:.28},
    embodiment:{bodyEnergy01:.82-(i%20)*.005,cognitiveCapacity01:.84,thermalStrain01:.18,sensoryFreshness01:.83,awake:true},
  });
}
const shadow=core.shadowOrganismSnapshot();
assert.ok(shadow.comparisons>0);
assert.equal(shadow.version,3);
assert.ok(shadow.ensembleDisagreement01>=0&&shadow.ensembleDisagreement01<=1);
assert.ok(shadow.recent.length>0);
const snap=core.snapshot();
assert.equal(snap.system.shadowOrganism.comparisons,shadow.comparisons);
await core.flush();
const persisted=await store.load();
assert.ok(persisted);
assert.equal(persisted.system.shadowOrganism.comparisons,shadow.comparisons);
const store2=new MemoryStateStore();
await store2.save(persisted);
const restored=new OrganismCore(store2,{enableWorldModel:true,enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await restored.init();
assert.equal(restored.shadowOrganismSnapshot().comparisons,shadow.comparisons);
assert.equal(restored.snapshot().state.tick,snap.state.tick);
console.log('BIG_PASS_61_CORE_SHADOW_E2E=PASS',JSON.stringify({tick:snap.state.tick,comparisons:shadow.comparisons,disagreement:shadow.ensembleDisagreement01,escalations:shadow.escalations}));
