import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<14;i++){
  await core.observe({text:i%3?'continue':'reflect on changed context',novelty:i%4===0?.68:.18,uncertainty:i%5===0?.70:.22,reward:i%4===0?.18:.84,success:i%4===0?.22:.86,surprise:i%3===0?.66:.12},'operational');
  await core.feedback({reward:i%4===0?.18:.84,success:i%4===0?.22:.86,surprise:i%3===0?.66:.12});
}
const d=core.b1101B1350Diagnostics();
assert(d.decisions>0);assert(d.updates>0);assert(d.memoryRecalls>0);assert(d.worldUpdates>0);assert(d.neuralUpdates>0);
const snap=core.snapshot();assert(snap.system?.b1101B1350SelfDevelopment);
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await restored.init();
const rd=restored.b1101B1350Diagnostics();assert.equal(rd.updates,d.updates);assert.equal(rd.decisions,d.decisions);
console.log('B1101_B1350_ORGANISM_PASS');
console.log(JSON.stringify({decisions:d.decisions,updates:d.updates,memoryRecalls:d.memoryRecalls,memoryRecallRows:d.memoryRecallRows,worldUpdates:d.worldUpdates,lookaheadCalls:d.lookaheadCalls,counterfactualCalls:d.counterfactualCalls,verifierCalls:d.verifierCalls,neuralUpdates:d.neuralUpdates,restartPersistence:true},null,2));
