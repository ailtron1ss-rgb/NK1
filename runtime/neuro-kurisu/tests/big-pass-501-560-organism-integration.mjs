import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<12;i++){
  await core.observe({text:i%6===0?'investigate why the prediction changed':'refine the current hypothesis and remember the useful pattern',novelty:i%6===0?.76:.24+(i%5)*.07,uncertainty:i%7===0?.78:.25+(i%6)*.06,reward:i%9===0?.18:.76,success:i%9===0?.18:.84,surprise:i%6===0?.72:.16,embodiment:{awake:true,bodyEnergy01:.86-(i%9)*.018,cognitiveCapacity01:.75,thermalStrain01:.12+(i%6)*.02,sensoryFreshness01:.80,battery01:.83-(i%10)*.012,cpuLoad01:.24,ramPressure01:.22}},'operational');
  await core.feedback({reward:i%9===0?.18:.76,success:i%9===0?.18:.84,surprise:i%6===0?.72:.16});
}
const d=core.b501B560Diagnostics();
assert(d.decisions>0); assert(d.updates>0); assert(d.retrievals>0); assert(d.consolidations>0);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init();
const rd=restored.b501B560Diagnostics(); assert.equal(rd.updates,d.updates); assert.equal(rd.consolidations,d.consolidations);
console.log(JSON.stringify({pass:true,status:'B501_B560_ORGANISM_PASS',decisions:d.decisions,updates:d.updates,retrievals:d.retrievals,consolidations:d.consolidations,experiments:d.experiments,counterfactuals:d.counterfactuals,developmentalGain01:d.developmentalGain01,restartPersistence:true},null,2));
