import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<32;i++){
  const grounded=i>=20;
  const shift=i>=8&&i<18;
  await core.observe({text:shift?'The previous expectation appears wrong. Investigate the conflict and revise the plan.':grounded?'Continue the current objective and preserve useful information.':i%3===0?'Develop a better way to understand the current situation.':'Continue the current objective and preserve useful information.',novelty:grounded?.42:(shift?.78:(.3+(i%6)*.08)),surprise:grounded?.12:(shift?.82:(.16+(i%5)*.09)),embodiment:{bodyEnergy01:grounded?.68:(shift?.68:.8-i*.008),cognitiveCapacity01:.83,thermalStrain01:.2,sensoryFreshness01:.86,awake:true,battery01:.74,cpuLoad01:.24,ramPressure01:.22}},'operational');
  await core.feedback({success:grounded?.92:(shift?(i%4===0?.27:.38):(i%5===0?.55:.76)),reward:grounded?.92:(shift?(i%3===0?.31:.39):(i%4===0?.73:.58)),surprise:grounded?.12:(shift?.82:(.14+(i%5)*.09)),evidenceSource:grounded?'external-api':'unknown'});
}
const d=core.b273AutonomousGoalDiagnostics();
assert.ok(d.cycles>=32,'B273 long Core cycle did not run');
assert.ok(d.learningUpdates>=28,'B273 did not learn through long Core cycle');
assert.ok(d.activeGoals>=0 && d.completedGoals>=0,'B273 lifecycle counters invalid');
assert.ok(d.singleActionSkillCount>0,'B273 did not learn an execution-grounded single-action skill in Core');
assert.ok(d.skillReuseOutcomes>0 && d.skillUses>0,'B273 learned skills were not reused in Core after grounded feedback');
assert.ok(d.longHorizonValue01>.25,'B273 long horizon state collapsed');
const p=core.personalitySummary(); assert.ok(p.causalUpdates>0,'personality did not receive Core evidence');
const snap=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.deepEqual(core2.b273AutonomousGoalDiagnostics(),d,'B273 long-cycle state did not survive restart');
console.log(JSON.stringify({pass:true,diagnostics:d,personality:p,restored:core2.b273AutonomousGoalDiagnostics(),current:core.b273AutonomousGoalCurrent()},null,2));
