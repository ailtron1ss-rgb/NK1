import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});await core.init();
for(let i=0;i<16;i++){
  await core.observe({text:i%2?'Find a new internal capability and test whether it helps the current goal.':'Explore a new way of acting while preserving self-consistency.',novelty:.58+(i%5)*.055,surprise:.16+(i%4)*.06,embodiment:{bodyEnergy01:.9-i*.012,cognitiveCapacity01:.84,thermalStrain01:.16,sensoryFreshness01:.9,awake:true,battery01:.76,cpuLoad01:.22,ramPressure01:.2}},'operational');
  await core.feedback({success:i%4===0?.8:.68,reward:i%3===0?.75:.64,surprise:.14+(i%4)*.05,evidenceSource:'unknown'});
}
const d=core.b278NeuralPrimitiveDiagnostics();assert.ok(d.cycles>=16);assert.ok(d.inventions>=1);assert.ok(d.learningUpdates>=1);assert.ok(d.neuralGrounding01>.4);assert.ok(d.selfBinding01>.4);const snap=core.snapshot();const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await core2.init();assert.deepEqual(core2.b278NeuralPrimitiveDiagnostics(),d);console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b278NeuralPrimitiveDiagnostics(),personality:core.personalitySummary()},null,2));
