import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<8;i++){
 await core.observe({text:i%3===0?'learn this surprising new pattern':'refine the prior successful procedure',novelty:i%3===0?.72:.24,uncertainty:i%4===0?.74:.28,reward:i%5===0?.18:.82,success:i%5===0?.18:.86,surprise:i%3===0?.64:.16,embodiment:{awake:true,bodyEnergy01:.86,cognitiveCapacity01:.76,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.81,cpuLoad01:.21,ramPressure01:.20}},'operational');
 await core.feedback({reward:i%5===0?.18:.82,success:i%5===0?.18:.86,surprise:i%3===0?.64:.16});
}
const d=core.b621B720Diagnostics(); assert(d.decisions>0); assert(d.updates>0); assert(d.neuralUpdates>0); const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); const rd=restored.b621B720Diagnostics(); assert.equal(rd.updates,d.updates); assert.equal(rd.decisions,d.decisions); console.log(JSON.stringify({pass:true,status:'B621_B720_ORGANISM_PASS',decisions:d.decisions,updates:d.updates,worldUpdates:d.worldUpdates,skillUpdates:d.skillUpdates,neuralUpdates:d.neuralUpdates,strategySwitches:d.strategySwitches,restartPersistence:true},null,2));
