import assert from 'node:assert/strict';
import { B334AutonomousProjectLifecycleGate } from '../src/organism/system/B334AutonomousProjectLifecycleGate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const gate=new B334AutonomousProjectLifecycleGate();
gate.restore();
gate.observeCycle({tick:1,at:1,externalInput:false,autonomous:true,commitments:[{id:'p1',domain:'learning',source:'intrinsic',createdAt:1,updatedAt:1,status:'active',progress01:0,revisions:0}],selectedAction:'verify',outcome01:.72,verifiedOutcome:true});
gate.observeCycle({tick:2,at:2,externalInput:false,autonomous:true,commitments:[{id:'p1',domain:'learning',source:'intrinsic',createdAt:1,updatedAt:2,status:'active',progress01:.12,revisions:0}],selectedAction:'verify',outcome01:.81,verifiedOutcome:true});
for(let t=3;t<=12;t++) gate.observeCycle({tick:t,at:t,externalInput:false,autonomous:true,commitments:[{id:'p1',domain:'learning',source:'intrinsic',createdAt:1,updatedAt:t,status:'active',progress01:.12,revisions:0}],selectedAction:'verify',outcome01:.70,verifiedOutcome:true});
let gd=gate.diagnostics();
assert.equal(gd.projectsStarted,1);
assert.ok(gd.recent[0].executions>=2);
assert.ok(gd.verifiedOutcomes>=2);
assert.equal(gd.evaluation.eligible,true);
const interrupted=new B334AutonomousProjectLifecycleGate();
interrupted.restore(gate.snapshot());
interrupted.observeCycle({tick:3,at:3,externalInput:false,autonomous:true,commitments:[{id:'p1',domain:'learning',source:'intrinsic',createdAt:1,updatedAt:3,status:'paused',progress01:.12,revisions:0}],selectedAction:null,outcome01:null,verifiedOutcome:false});
interrupted.observeCycle({tick:4,at:4,externalInput:false,autonomous:true,commitments:[{id:'p1',domain:'learning',source:'intrinsic',createdAt:1,updatedAt:4,status:'active',progress01:.2,revisions:1}],selectedAction:'verify',outcome01:.77,verifiedOutcome:true,resumedIds:['p1']});
const id=interrupted.diagnostics();
assert.ok(id.resumeEvents>=1);
assert.ok(id.revisions>=1);
assert.ok(id.recent[0].history.includes('interruption'));
assert.ok(id.recent[0].history.includes('resume'));

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<16;i++){
  await core.observe({text:'',novelty:.50+(i%5)*.04,surprise:.34+(i%4)*.06,embodiment:{bodyEnergy01:.74,cognitiveCapacity01:.83,thermalStrain01:.16,sensoryFreshness01:.93,awake:true,battery01:.78,cpuLoad01:.21,ramPressure01:.21}},'operational');
  await core.feedback({success:i%9===0?.70:.63,reward:i%7===0?.74:.59,surprise:.25,evidenceSource:'internal'});
}
const live=core.b334AutonomousProjectLifecycleDiagnostics();
assert.ok(live.cycles>=14,'B334 did not run in live Core');
assert.ok(live.projectsStarted>0,'live Core created no self-directed project');

const externalCore=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await externalCore.init();
for(let i=0;i<6;i++){
  await externalCore.observe({text:'выполни внешний запрос',novelty:.50,surprise:.34,embodiment:{bodyEnergy01:.74,cognitiveCapacity01:.83,thermalStrain01:.16,sensoryFreshness01:.93,awake:true,battery01:.78,cpuLoad01:.21,ramPressure01:.21}},'operational');
  await externalCore.feedback({success:.63,reward:.59,surprise:.25,evidenceSource:'internal'});
}
const external=externalCore.b334AutonomousProjectLifecycleDiagnostics();
assert.ok(external.externalInputCycles>=5,'negative control did not record external input');
assert.equal(external.projectsStarted,0,'external request unexpectedly created autonomous project');
assert.equal(external.evaluation.eligible,false,'external request passed autonomous lifecycle gate');

const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
const restored=core2.b334AutonomousProjectLifecycleDiagnostics();
assert.deepEqual(restored,live,'B334 restart persistence mismatch');
console.log(JSON.stringify({pass:true,unit:gd,interruptResume:id,live,restored},null,2));
