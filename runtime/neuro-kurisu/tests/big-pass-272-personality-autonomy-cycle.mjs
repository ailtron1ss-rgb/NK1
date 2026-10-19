import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<16;i++){
  await core.observe({text:i%2?'A conflict appeared; inspect and compare what you expected.':'New opportunity with uncertainty; investigate rather than assume.',novelty:.42+(i%5)*.07,surprise:.18+(i%4)*.11,embodiment:{bodyEnergy01:.78,cognitiveCapacity01:.86,thermalStrain01:.2,sensoryFreshness01:.88,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}},'operational');
  await core.feedback({success:i%4===0?.56:.73,reward:i%3===0?.67:.59,surprise:.14+(i%5)*.08,evidenceSource:'unknown'});
}
const g=core.b272EndogenousGoalDiagnostics(); const p=core.personalitySummary();
assert.ok(g.learningUpdates>=7,'live cycle did not train B272');
assert.ok(g.generatedGoals>=7,'live cycle did not generate B272 goals');
assert.ok(p.causalUpdates>0,'personality did not receive B272 evidence');
assert.ok(g.goalPressure01>.1,'goal pressure inert');
const current=core.b272EndogenousGoalCurrent(); assert.ok(current.endogenous01>.2,'goal was not endogenous enough');
console.log(JSON.stringify({pass:true,b272:g,personality:p,currentGoal:current},null,2));
