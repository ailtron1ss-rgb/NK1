import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<14;i++){
  await core.observe({text:i%3===0?'Find a new way to investigate this and test it.':i%3===1?'Something changed; compare alternatives.':'Reflect, preserve what works, and explore a safer variant.',novelty:.34+(i%5)*.09,surprise:.17+(i%6)*.085,embodiment:{bodyEnergy01:.82-i*.018,cognitiveCapacity01:.83,thermalStrain01:.2,sensoryFreshness01:.86,awake:true,battery01:.72,cpuLoad01:.22,ramPressure01:.21}},'operational');
  await core.feedback({success:i%4===0?.46:.77,reward:i%3===0?.75:.58,surprise:.12+(i%6)*.08,evidenceSource:'unknown'});
}
const d=core.b274SkillDiagnostics();
assert.ok(d.cycles>=14,'B274 did not run in Core');
assert.ok(d.imaginedExperiments>0,'B274 did not imagine skill experiments');
assert.ok(d.realTrials>0,'B274 did not execute skill trials');
assert.ok(d.selfAlignment01>=0 && d.neuralGrounding01>=0,'B274 diagnostics invalid');
const snap=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.deepEqual(core2.b274SkillDiagnostics(),d,'B274 Core restart mismatch');
console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b274SkillDiagnostics(),personality:core.personalitySummary()},null,2));
