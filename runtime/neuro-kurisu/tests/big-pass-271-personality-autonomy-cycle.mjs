import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<18;i++){
  await core.observe({text:i%3===0?'New evidence appeared; explore and compare with your previous experience.':i%3===1?'Something conflicts with what you expected; verify it.':'Reflect on what changed and preserve what still fits.',novelty:.35+(i%5)*.09,surprise:.16+(i%6)*.11,embodiment:{bodyEnergy01:.8-i*.015,cognitiveCapacity01:.84,thermalStrain01:.2,sensoryFreshness01:.86,awake:true,battery01:.76,cpuLoad01:.23,ramPressure01:.22}},'operational');
  await core.feedback({success:i%5===0?.55:0.75,reward:i%4===0?.76:0.58,surprise:.13+(i%6)*.09,evidenceSource:'unknown'});
}
const auto=core.b271NeuralAutobiographyDiagnostics();
const personality=core.personalitySummary();
assert.ok(auto.learningUpdates>=8,'B271 did not learn through live lifecycle');
assert.ok(auto.autobiographicalContinuity01>.45,'autobiographical continuity collapsed');
assert.ok(auto.reconstruction01>.18,'neural reconstruction not active');
assert.ok(personality.causalUpdates>0,'personality did not receive neural autobiographical evidence');
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.deepEqual(core2.b271NeuralAutobiographyDiagnostics(),auto,'B271 did not survive full organism restart');
console.log(JSON.stringify({pass:true,autobiography:auto,personality,restored:core2.b271NeuralAutobiographyDiagnostics()},null,2));
