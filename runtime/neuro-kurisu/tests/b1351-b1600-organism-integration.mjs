import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});await core.init();
for(let i=0;i<18;i++){await core.observe({text:i%3?'continue with the current internal development':'new situation requires reconsideration',novelty:i%4===0?.70:.16,uncertainty:i%5===0?.71:.20,reward:i%4===0?.16:.86,success:i%4===0?.20:.88,surprise:i%3===0?.67:.11},'operational');await core.feedback({reward:i%4===0?.16:.86,success:i%4===0?.20:.88,surprise:i%3===0?.67:.11});}
const d=core.b1351B1600Diagnostics();assert(d.decisions>0);assert(d.updates>0);assert(d.worldUpdates>0);assert(d.neuralUpdates>0);assert(d.curriculumSelections>0);
const snap=core.snapshot();assert(snap.system?.b1351B1600LifelongDevelopment);
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await restored.init();const rd=restored.b1351B1600Diagnostics();assert.equal(rd.updates,d.updates);assert.equal(rd.decisions,d.decisions);
console.log('B1351_B1600_ORGANISM_PASS');console.log(JSON.stringify({decisions:d.decisions,updates:d.updates,sleepCycles:d.sleepCycles,replays:d.replays,worldUpdates:d.worldUpdates,causalUpdates:d.causalUpdates,neuralUpdates:d.neuralUpdates,curriculumSelections:d.curriculumSelections,taskTransfers:d.taskTransfers,restartPersistence:true},null,2));
