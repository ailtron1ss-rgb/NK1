import assert from 'node:assert/strict';
import { InteroceptiveStateEstimator } from '../src/organism/system/InteroceptiveStateEstimator.ts';
import { AutonomousPersonhoodKernel } from '../src/organism/system/AutonomousPersonhoodKernel.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const intero=new InteroceptiveStateEstimator();
const calm=intero.observe({energy01:.86,thermal01:.18,cognitiveLoad01:.22,sleepPressure01:.08,capacity01:.82,sensoryFreshness01:.95,externalInput:false});
const conflict=intero.observe({energy01:.22,thermal01:.86,cognitiveLoad01:.88,sleepPressure01:.76,capacity01:.34,sensoryFreshness01:.55,externalInput:false});
assert.ok(conflict.predictionError01>calm.predictionError01,'interoceptive prediction error did not respond');
assert.ok(conflict.controlPressure01>calm.controlPressure01,'interoceptive control pressure did not respond');
assert.ok(conflict.uncertainty01>calm.uncertainty01,'interoceptive uncertainty did not respond');
const restoredIntero=new InteroceptiveStateEstimator(); restoredIntero.restore(intero.snapshot()); assert.equal(restoredIntero.diagnostics().ticks,2,'interoceptive persistence failed');

const apk=new AutonomousPersonhoodKernel();
const plan=apk.plan({tick:1,at:1,externalInput:false,energy01:.78,thermal01:.2,uncertainty01:.72,goalPressure01:.64,novelty01:.82,identity01:.88,homeostaticPressure01:.2,predictionError01:.66,activeGoals:1,activeProject:false,recoveryPressure01:.18});
assert.ok(plan.autonomousAllowed,'autonomy gate rejected healthy internally-driven state');
assert.ok(plan.initiative01>.42,'initiative too weak');
assert.ok(plan.agendaItem,'self-authored agenda item was not created');
const biasExplore=apk.bias('explore',plan,null); const biasWait=apk.bias('wait',plan,null); assert.ok(biasExplore>0 || biasWait>0,'autonomy kernel did not bias internal action');
apk.recordDecision(true,.9); apk.recordOutcome(plan.agendaItem?.mode==='learning'?'verify':'explore',.88);
const apkRestored=new AutonomousPersonhoodKernel(); apkRestored.restore(apk.snapshot()); assert.equal(apkRestored.summary().autonomousDecisions,1,'autonomous decision persistence failed');

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg); await core.init();
for(let i=0;i<5;i++){
  await core.observe({worldContext:{location:'autonomy-lab',facts:['no external request','internal unresolved problem'],objects:[],events:[]},novelty:.78,surprise:.32,embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.82,thermalStrain01:.18,sensoryFreshness01:.92,awake:true,battery01:.82,cpuLoad01:.22,ramPressure01:.22}});
  await core.feedback({success:.74,reward:.76,evidenceSource:'b221-autonomy-test',surprise:.18});
}
await core.flush();
const snap=core.systemSnapshot();
const auto=snap.autonomousPersonhood;
assert.ok((auto?.ticks??0)>=5,'core did not advance persistent autonomy kernel');
assert.ok((auto?.autonomousDecisions??0)>=5,'core did not register autonomous decisions');
assert.ok((auto?.initiatives??0)>=1,'core did not produce a self-authored initiative');
assert.ok(core.snapshot().goals.some(g=>g.source==='intrinsic'||g.source==='homeostatic'),'core did not materialize autonomous goal');
const restored=new OrganismCore(store,cfg); await restored.init();
assert.equal(restored.systemSnapshot().autonomousPersonhood?.ticks,auto.ticks,'core autonomy state did not survive restart');
assert.equal(restored.systemSnapshot().interoceptiveState?.ticks,snap.interoceptiveState?.ticks,'interoceptive state did not survive restart');
console.log(JSON.stringify({pass:'BIG_PASS_221_INTEROCEPTION_AUTONOMY',intero:{calmError01:calm.predictionError01,conflictError01:conflict.predictionError01,calmUncertainty01:calm.uncertainty01,conflictUncertainty01:conflict.uncertainty01,calmControl01:calm.controlPressure01,conflictControl01:conflict.controlPressure01},autonomy:{initiative01:plan.initiative01,mode:plan.agendaItem?.mode??null,title:plan.agendaItem?.title??null,restoredDecisions:apkRestored.summary().autonomousDecisions},core:{ticks:auto?.ticks,autonomousDecisions:auto?.autonomousDecisions,initiatives:auto?.initiatives,externalDependence01:auto?.externalDependence01,activeGoals:restored.snapshot().goals.filter(g=>g.status==='active').length},verified:true},null,2));
