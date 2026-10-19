import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<16;i++){
  await core.observe({text:i%4===0?'Investigate the new evidence and compare it to what was learned.':i%4===1?'Something changed; verify the discrepancy.':i%4===2?'Try another way and see what happens.':'Reflect on what changed and what should be preserved.',novelty:.32+(i%5)*.1,surprise:.18+(i%6)*.1,embodiment:{bodyEnergy01:.8-i*.018,cognitiveCapacity01:.83,thermalStrain01:.2,sensoryFreshness01:.85,awake:true,battery01:.74,cpuLoad01:.23,ramPressure01:.22}},'operational');
  await core.feedback({success:i%5===0?.44:.76,reward:i%4===0?.73:.57,surprise:.14+(i%6)*.1,evidenceSource:'unknown'});
}
const d=core.b273AutonomousGoalDiagnostics();
const p=core.personalitySummary();
assert.ok(d.cycles>=16,'B273 did not run in live Core lifecycle');
assert.ok(d.learningUpdates>0,'B273 did not learn from outcomes');
assert.ok(d.goalCreations>0,'B273 did not create lifecycle goals');
assert.ok(d.hierarchicalGoalRate01>=0,'B273 diagnostics invalid');
assert.ok(p.causalUpdates>0,'personality did not receive causal updates');
const snap=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.deepEqual(core2.b273AutonomousGoalDiagnostics(),d,'B273 did not survive Core restart');
console.log(JSON.stringify({pass:true,diagnostics:d,personality:p,current:core.b273AutonomousGoalCurrent(),restored:core2.b273AutonomousGoalDiagnostics()},null,2));
