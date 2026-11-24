import assert from 'node:assert/strict';
import { SelfGovernanceEngine } from '../src/organism/cognition/evolution/SelfGovernanceEngine.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// Governance history must be bounded while cumulative counters retain longitudinal signal.
const gov=new SelfGovernanceEngine();
for(let i=0;i<420;i++){
  gov.recordDecision({requestedAction:i%3===0?'verify':null,chosenAction:i%5===0?'explore':'verify',autonomous:i%2===0,internalPressure:.5,commitmentPressure:.4,regretPressure:.2,reason:`r${i}`});
  gov.recordConsequence({action:i%2===0?'verify':'explore',expectedReward:.7,actualReward:i%7===0?.35:.68,counterfactualBest:.74,source:'test'});
}
const g=gov.snapshot(); const light=gov.snapshotLight();
assert.equal(g.totalRecords,420);
assert.equal(g.totalConsequences,420);
assert.ok(g.records.length<=160);
assert.ok(g.consequences.length<=192);
assert.equal(light.totalRecords,420);
assert.equal(light.totalConsequences,420);
const restoredGov=new SelfGovernanceEngine();
restoredGov.restore(g);
const restored=restoredGov.snapshotLight();
assert.equal(restored.totalRecords,420);
assert.equal(restored.totalConsequences,420);
assert.equal(restoredGov.snapshot().records.length,160);

// Compatibility memory is eventual-consistent, not one-new-item-per-tick.
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
for(let i=0;i<128;i++) await core.observeOperational({embodiment:{bodyEnergy01:.82,thermalStrain01:.16,cognitiveCapacity01:.84,sensoryFreshness01:.86,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.18},reward:i%43===0?.7:undefined});
const count=core.snapshotLight().memoryCount;
assert.ok(count<100,`compatibility mirror expanded too aggressively: ${count}`);
console.log('BIG_PASS_45_RETENTION_GOVERNANCE=PASS',JSON.stringify({records:g.records.length,consequences:g.consequences.length,totalRecords:g.totalRecords,totalConsequences:g.totalConsequences,memoryCount:count}));
