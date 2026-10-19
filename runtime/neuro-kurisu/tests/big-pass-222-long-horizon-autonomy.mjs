import assert from 'node:assert/strict';
import { LongHorizonAutonomyController } from '../src/organism/system/LongHorizonAutonomyController.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const ctl=new LongHorizonAutonomyController();
const agenda={id:'agenda:test-222',title:'Самостоятельно исследовать и проверить вопрос',reason:'устойчивая внутренняя потребность в знании',mode:'learning',priority01:.84,commitment01:.78};
const plan=ctl.plan({tick:10,at:10,agenda,energy01:.84,uncertainty01:.66,predictionError01:.59,identity01:.9,homeostaticPressure01:.18,novelty01:.82});
assert.ok(plan,'long-horizon plan was not created');
assert.ok(plan.steps.length>=3,'plan was not decomposed into multiple steps');
assert.equal(plan.steps[0].status,'active');
assert.ok(ctl.bias(plan.steps[0].action,plan)>=.1,'active step did not bias matching action');
ctl.observeExecution({action:plan.steps[0].action,success01:.9,predictionError01:.2,at:20});
const p2=ctl.plan({tick:21,at:21,agenda:null,energy01:.8,uncertainty01:.5,predictionError01:.25,identity01:.9,homeostaticPressure01:.2,novelty01:.4});
assert.ok(p2 && p2.steps.some(s=>s.status==='active'),'plan did not advance after successful step');
const before=ctl.snapshot();
const restoredCtl=new LongHorizonAutonomyController();restoredCtl.restore(before);
assert.equal(restoredCtl.summary().activePlan?.id,ctl.summary().activePlan?.id,'long-horizon plan persistence failed');

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);await core.init();
for(let i=0;i<14;i++){
 await core.observe({worldContext:{location:'autonomy-lab',facts:['no external request','internal unresolved problem'],objects:[],events:[]},novelty:.78,surprise:.34,embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.82,thermalStrain01:.18,sensoryFreshness01:.92,awake:true,battery01:.82,cpuLoad01:.22,ramPressure01:.22}});
 await core.feedback({success:.78,reward:.8,evidenceSource:'b222-long-horizon-test',surprise:.16});
}
await core.flush();
const snap=core.systemSnapshot();
const lh=snap.longHorizonAutonomy;
assert.ok((lh?.plansCreated??0)>=1,'core did not create long-horizon autonomous plan');
assert.ok((lh?.stepsStarted??0)>=1,'core did not execute a long-horizon step');
assert.ok((lh?.meanLongHorizon01??0)>.3,'long-horizon autonomy score did not advance');
const restored=new OrganismCore(store,cfg);await restored.init();
assert.equal(restored.systemSnapshot().longHorizonAutonomy?.plansCreated,lh?.plansCreated,'long-horizon state did not survive restart');
console.log(JSON.stringify({pass:'BIG_PASS_222_LONG_HORIZON_AUTONOMY',controller:{created:before.plansCreated,completed:before.stepsCompleted,revisions:before.revisions,activePlan:restoredCtl.summary().activePlan?.title??null},core:{plansCreated:lh?.plansCreated,stepsStarted:lh?.stepsStarted,stepsCompleted:lh?.stepsCompleted,stepsFailed:lh?.stepsFailed,meanLongHorizon01:lh?.meanLongHorizon01,meanCommitment01:lh?.meanCommitment01,persistedPlans:restored.systemSnapshot().longHorizonAutonomy?.plans?.length??0},verified:true},null,2));
