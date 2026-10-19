import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const embodiment={bodyEnergy01:.74,cognitiveCapacity01:.83,thermalStrain01:.16,sensoryFreshness01:.93,awake:true,battery01:.78,cpuLoad01:.21,ramPressure01:.21};
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
core.b335AutonomousProjectHoldoutSetPhase('baseline');
for(let i=0;i<4;i){ await core.observe({text:'',novelty:.45+(i%3)*.05,surprise:.28+(i%2)*.05,embodiment},'operational'); await core.feedback({success:.65,reward:.62,surprise:.22,evidenceSource:'internal'}); }
core.b335AutonomousProjectHoldoutSetPhase('training');
for(let i=0;i<4;i){ await core.observe({text:'',novelty:.53+(i%2)*.05,surprise:.31+(i%3)*.04,embodiment},'operational'); await core.feedback({success:.68,reward:.64,surprise:.22,evidenceSource:'internal'}); }
const training=core.b335AutonomousProjectHoldoutDiagnostics();
core.b335AutonomousProjectHoldoutSetPhase('holdout');
for(let i=0;i<4;i){ await core.observe({text:'',novelty:.72-(i%2)*.04,surprise:.42-(i%3)*.03,embodiment},'operational'); await core.feedback({success:.71,reward:.67,surprise:.24,evidenceSource:'internal'}); }
const live=core.b335AutonomousProjectHoldoutDiagnostics();
assert.ok(live.cycles>=12); assert.ok(live.holdoutCycles>=4); assert.ok(live.trainingVerifiedOutcomes>=3);
const snap=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
const restored=core2.b335AutonomousProjectHoldoutDiagnostics(); assert.deepEqual(restored,live);
console.log(JSON.stringify({pass:true,training,live,restored},null,2));
