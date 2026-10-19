import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});await core.init();
for(let i=0;i<18;i++){
  await core.observe({text:i%3===0?'Explore a new route and compare it with what you know.':i%3===1?'Verify whether the previous strategy still works.':'Reflect on what worked, preserve useful structure, and combine it with another strategy.',novelty:.42+(i%4)*.08,surprise:.18+(i%5)*.07,embodiment:{bodyEnergy01:.83-i*.012,cognitiveCapacity01:.82,thermalStrain01:.2,sensoryFreshness01:.88,awake:true,battery01:.72,cpuLoad01:.24,ramPressure01:.22}},'operational');
  await core.feedback({success:i%5===0?.48:.76,reward:i%4===0?.74:.60,surprise:.14+(i%6)*.07,evidenceSource:'unknown'});
}
const d=core.b275PolicyDiagnostics();
assert.ok(d.decisions>0);assert.ok(d.learningUpdates>0);assert.ok(d.neuralGrounding01>0);assert.ok(d.policyEntropy01>=0&&d.policyEntropy01<=1);
const snap=core.snapshot();const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await core2.init();assert.deepEqual(core2.b275PolicyDiagnostics(),d);
console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b275PolicyDiagnostics(),personality:core.personalitySummary()},null,2));
