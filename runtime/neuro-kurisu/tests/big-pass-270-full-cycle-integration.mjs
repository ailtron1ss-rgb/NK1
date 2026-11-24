import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<12;i++){
  await core.observe({text:i%3===0?'Explore this new situation and verify it.':'Continue developing the current task.',novelty:.3+(i%4)*.12,surprise:.2+(i%5)*.1,embodiment:{bodyEnergy01:.78-i*.018,cognitiveCapacity01:.82,thermalStrain01:.2,sensoryFreshness01:.8,awake:true,battery01:.76,cpuLoad01:.24,ramPressure01:.22}},'operational');
  await core.feedback({success:i%4!==1?1:.45,reward:i%4===0?.75:.48,surprise:.2+(i%5)*.1,evidenceSource:'unknown'});
}
const d=core.b270NeuralGerminalDiagnostics();
const p=core.personalitySummary();
assert.ok(d.cycles>=12,'B270 did not run in full OrganismCore lifecycle');
assert.ok(d.learningUpdates>0,'B270 did not receive lifecycle outcomes');
assert.ok(Object.values(d.traitValues).some(v=>Math.abs(v-.5)>.01),'B270 traits did not change');
assert.ok(p.hypotheses>=0,'invalid personality summary');
const snap=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.equal(core2.b270NeuralGerminalDiagnostics().cycles,d.cycles,'lifecycle B270 state not persistent');
console.log(JSON.stringify({pass:true,diagnostics:d,personality:p,restored:core2.b270NeuralGerminalDiagnostics()},null,2));
