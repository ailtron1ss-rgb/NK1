import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableWorldModel:true,enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
for(let i=0;i<160;i++){
  const r=await core.observe({text:i%17===0?'проверь текущую ситуацию':undefined, success:i%11===0?.8:undefined, reward:i%11===0?.75:undefined, worldContext:{location:'phone-lab',facts:[i%13===0?'novel-event':'stable'],uncertainty:i%7===0?.65:.25}, embodiment:{bodyEnergy01:.78-(i%30)*.004,cognitiveCapacity01:.86,thermalStrain01:.2,sensoryFreshness01:.8,awake:true}});
  assert.ok(r.decision);
}
const snap=core.snapshot();
assert.equal(snap.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.equal(snap.facets.advanced.p80UnifiedSelfState.cycles,160);
assert.equal(snap.facets.advanced.p81PredictiveAttention.cycles,160);
assert.equal(snap.facets.advanced.p82RealityProgress.observations,160);
const hashBefore=JSON.stringify({p80:snap.facets.advanced.p80UnifiedSelfState,p81:snap.facets.advanced.p81PredictiveAttention,p82:snap.facets.advanced.p82RealityProgress});
await core.flush();
const persisted=await store.load();
assert.ok(persisted);
const restored=persisted;
const hashAfter=JSON.stringify({p80:restored.facets.advanced.p80UnifiedSelfState,p81:restored.facets.advanced.p81PredictiveAttention,p82:restored.facets.advanced.p82RealityProgress});
assert.equal(hashAfter,hashBefore);
console.log('P80_P82_RUNTIME_E2E=PASS', JSON.stringify({tick:restored.state.tick,p80:restored.facets.advanced.p80UnifiedSelfState.cycles,p81:restored.facets.advanced.p81PredictiveAttention.cycles,p82:restored.facets.advanced.p82RealityProgress.observations}));
