import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<8;i++){
 await core.observe({text:i%4===0?'test and consolidate this new pattern':'refine the current hypothesis and use the previous successful procedure',novelty:i%4===0?.74:.22+(i%5)*.06,uncertainty:i%5===0?.76:.24+(i%4)*.07,reward:i%6===0?.15:.78,success:i%6===0?.15:.86,surprise:i%4===0?.70:.15,embodiment:{awake:true,bodyEnergy01:.86-(i%7)*.02,cognitiveCapacity01:.75,thermalStrain01:.12+(i%4)*.025,sensoryFreshness01:.80,battery01:.82-(i%8)*.01,cpuLoad01:.24,ramPressure01:.21}},'operational');
 await core.feedback({reward:i%6===0?.15:.78,success:i%6===0?.15:.86,surprise:i%4===0?.70:.15});
}
const d=core.b561B620Diagnostics(); assert(d.decisions>0); assert(d.updates>0); assert(d.retrievals>0); assert(d.neuralUpdates>0);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init();
const rd=restored.b561B620Diagnostics(); assert.equal(rd.updates,d.updates); assert.equal(rd.decisions,d.decisions);
const health=await restored.observe({text:'restart continuity probe',novelty:.62,uncertainty:.61,reward:.7,success:.78,surprise:.3,embodiment:{awake:true,bodyEnergy01:.82,cognitiveCapacity01:.76,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.79,cpuLoad01:.2,ramPressure01:.2}},'operational');
assert(health!=null);
console.log(JSON.stringify({pass:true,status:'B561_B620_ORGANISM_PASS',decisions:d.decisions,updates:d.updates,retrievals:d.retrievals,skills:d.skillUpdates,neuralUpdates:d.neuralUpdates,experiments:d.experiments,holdouts:d.holdouts,restartPersistence:true,postRestartTick:restored.operationalStatusSnapshot().tick},null,2));
