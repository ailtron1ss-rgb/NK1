import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { AutonomousPersonhoodKernel } from '../src/organism/system/AutonomousPersonhoodKernel.ts';

const apk=new AutonomousPersonhoodKernel();
const plan=apk.plan({tick:1,at:1,externalInput:false,energy01:.82,thermal01:.16,uncertainty01:.82,goalPressure01:.74,novelty01:.88,identity01:.9,homeostaticPressure01:.22,predictionError01:.78,activeGoals:1,activeProject:false,recoveryPressure01:.12});
assert.ok(plan.autonomousAllowed,'healthy internal state was not allowed to act autonomously');
assert.ok(plan.agendaItem,'self-authored initiative was not generated');
const normalBias=apk.bias('verify',plan,null)+apk.bias('explore',plan,null)+apk.bias('reflect',plan,null)+apk.bias('rest',plan,null)+apk.bias('wait',plan,null);
apk.lesion(.9);
const lesionedBias=apk.bias('verify',plan,null)+apk.bias('explore',plan,null)+apk.bias('reflect',plan,null)+apk.bias('rest',plan,null)+apk.bias('wait',plan,null);
assert.ok(normalBias>lesionedBias+0.0001,'autonomous-personhood lesion did not reduce causal influence');

const cfg={enableLanguage:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:128,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true,enableTemporalResolutionGovernor:true,operationalPulseEvery:4};
const store=new MemoryStateStore();
const core=new OrganismCore(store,cfg); await core.init();
for(let i=0;i<16;i++){
  await core.observe({
    worldContext:{location:`b306-internal-${i%3}`,facts:['no external request','unresolved internal discrepancy'],objects:[],events:['internal-pressure']},
    novelty:.74+(i%4)*.045,
    surprise:.38+(i%3)*.08,
    embodiment:{bodyEnergy01:.84-i*.008,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.92,awake:true,battery01:.82,cpuLoad01:.20,ramPressure01:.22},
  });
  await core.feedback({success:i%4===0?.84:.66,reward:i%4===0?.86:.64,evidenceSource:'b306-autonomous-causal',surprise:.26});
}
const d=core.b306AutonomousInitiativeDiagnostics();
assert.ok(d.decisions>=12,'B306 did not observe enough decisions');
assert.ok(d.eligibleAutonomousDecisions>=8,'B306 did not identify enough autonomous-eligible decisions');
assert.ok(d.agendaCreations>=1,'B306 saw no self-authored agenda creation');
assert.ok(d.causallyInfluencedDecisions>=1,'autonomous kernel never changed the action ranking in live core');
assert.ok(d.causalInfluenceRate01>0,'causal influence rate is zero');
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),cfg); await restored.init();
const restoredD=restored.b306AutonomousInitiativeDiagnostics();
assert.equal(restoredD.decisions,d.decisions,'B306 decision count did not survive restart');
assert.equal(restoredD.causallyInfluencedDecisions,d.causallyInfluencedDecisions,'B306 causal influence count did not survive restart');
core.autonomousPersonhoodLesion(.95);
const lesionSnapshot=core.snapshot();
const lesioned=new OrganismCore(new MemoryStateStore({initial:lesionSnapshot}),cfg); await lesioned.init();
const before=core.systemSnapshot().autonomousPersonhood;
const after=lesioned.systemSnapshot().autonomousPersonhood;
assert.equal(after?.lesion01,.95,'autonomous personhood lesion did not persist');
console.log(JSON.stringify({pass:'BIG_PASS_306_AUTONOMOUS_CAUSAL_VERIFICATION',kernel:{initiative01:plan.initiative01,mode:plan.agendaItem?.mode??null,normalBiasSum:normalBias,lesionedBiasSum:lesionedBias},core:{decisions:d.decisions,eligible:d.eligibleAutonomousDecisions,agendaCreations:d.agendaCreations,causallyInfluenced:d.causallyInfluencedDecisions,causalInfluenceRate01:d.causalInfluenceRate01,causalSuccessRate01:d.causalSuccessRate01,meanKernelBias01:d.meanKernelBias01,meanCounterfactualMargin01:d.meanCounterfactualMargin01},restart:{decisions:restoredD.decisions,causallyInfluenced:restoredD.causallyInfluencedDecisions},lesion:{before:before?.lesion01,after:after?.lesion01},verified:true},null,2));
