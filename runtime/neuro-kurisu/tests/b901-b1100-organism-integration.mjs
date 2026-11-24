import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<18;i++){
 await core.observe({text:i%3?'continue':'reflect on what changed',novelty:i%4===0?.64:.20,uncertainty:i%5===0?.72:.25,reward:i%4===0?.18:.82,success:i%4===0?.18:.86,surprise:i%3===0?.65:.14},'operational');
 await core.feedback({reward:i%4===0?.18:.82,success:i%4===0?.18:.86,surprise:i%3===0?.65:.14});
}
const d=core.b901B1100Diagnostics();assert(d.decisions>0);assert(d.updates>0);assert(d.neuralUpdates>0);
const snap=core.snapshot();assert(snap.system?.b901B1100CausalDevelopmentalMetaLearner);
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await restored.init();
const rd=restored.b901B1100Diagnostics();assert.equal(rd.updates,d.updates);assert.equal(rd.decisions,d.decisions);
console.log('B901_B1100_ORGANISM_PASS');console.log(JSON.stringify({decisions:d.decisions,updates:d.updates,taskAssignments:d.taskAssignments,replays:d.replays,alignmentChecks:d.alignmentChecks,neuralUpdates:d.neuralUpdates,restartPersistence:true},null,2));
