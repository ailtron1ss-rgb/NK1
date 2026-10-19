import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<6;i++){
  await core.observe({text:'Discover a safer way to solve the current goal.',novelty:.55,surprise:.24,embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.84,thermalStrain01:.2,sensoryFreshness01:.85,awake:true,battery01:.72,cpuLoad01:.22,ramPressure01:.21}},'operational');
  await core.feedback({success:.78,reward:.64,surprise:.18,evidenceSource:'unknown'});
}
const before=core.b274SkillDiagnostics();
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init();
assert.deepEqual(restored.b274SkillDiagnostics(),before,'B274 migration round-trip mismatch');
console.log(JSON.stringify({pass:true,diagnostics:before},null,2));
