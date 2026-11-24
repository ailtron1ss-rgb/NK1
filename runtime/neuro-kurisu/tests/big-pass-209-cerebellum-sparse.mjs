import assert from 'node:assert/strict';
import { CerebellarPredictiveController } from '../src/organism/system/CerebellarPredictiveController.ts';
import { AdaptiveComputeGovernor } from '../src/organism/system/AdaptiveComputeGovernor.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const baseCandidates=Array.from({length:10},(_,i)=>({action:`a${i}`,score:.52+i*.02,confidence01:.62+(i%3)*.06,predictedUtility:.5+i*.015}));

const cerebellum=new CerebellarPredictiveController();
let initial=cerebellum.calibrate([{action:'explore',score:.7,confidence01:.6,predictedUtility:.55}],{predictionError01:.6,uncertainty01:.5,novelty01:.5,bodyEnergy01:.9,thermal01:.1,cognitiveCapacity01:.9,tick:1});
const before=initial.rows[0].forwardError01;
for(let i=0;i<20;i++) cerebellum.recordOutcome('explore',.52,.9,.65,i+2);
const afterFrame=cerebellum.calibrate([{action:'explore',score:.7,confidence01:.6,predictedUtility:.55}],{predictionError01:.45,uncertainty01:.35,novelty01:.3,bodyEnergy01:.9,thermal01:.1,cognitiveCapacity01:.9,tick:25});
const after=afterFrame.rows[0].forwardError01;
assert.ok(after < before,'forward model error should improve after repeated outcomes');
assert.ok(Math.abs((cerebellum.diagnostics().bestCalibratedError01??1)-after) < .2);

cerebellum.setLesion(true);
const lesioned=cerebellum.calibrate([{action:'explore',score:.7,confidence01:.6,predictedUtility:.55}],{predictionError01:.45,uncertainty01:.35,novelty01:.3,bodyEnergy01:.9,thermal01:.1,cognitiveCapacity01:.9,tick:26});
assert.equal(lesioned.lesionApplied,true);
assert.ok(Math.abs(lesioned.rows[0].correction01) < Math.abs(afterFrame.rows[0].correction01)+.0001);

const governor=new AdaptiveComputeGovernor();
const rich=governor.plan({surprise01:.78,predictionError01:.74,uncertainty01:.7,novelty01:.68,salience01:.8,bodyEnergy01:.9,thermal01:.1,cognitiveCapacity01:.92,memoryPressure01:.2,phoneMode:false,tick:1});
const scarce=governor.plan({surprise01:.05,predictionError01:.08,uncertainty01:.12,novelty01:.08,salience01:.18,bodyEnergy01:.2,thermal01:.82,cognitiveCapacity01:.28,memoryPressure01:.82,phoneMode:true,tick:2});
assert.ok(rich.budget01 > scarce.budget01,'high surprise should increase compute budget');
assert.ok(scarce.sparsity01 > rich.sparsity01,'resource scarcity should increase sparsity');
assert.ok(scarce.maxCandidates < rich.maxCandidates,'scarcity should reduce candidate processing');
assert.ok(scarce.estimatedWorkSaved01 > rich.estimatedWorkSaved01);

const coordinator=new CognitiveKernelCoordinator(new P61IntegratedMindKernel(),new P64IntegratedOrganismDynamics());
const commonSignals={identity01:.84,workspace01:.76,metacognitive01:.72,predictionError01:.55,uncertainty01:.5,novelty01:.5,grounding01:.84,causal01:.78,bodyEnergy01:.82,thermal01:.18,cognitiveCapacity01:.88,memoryPressure01:.2,socialNeed01:.22,goalPressure01:.75,realityGap01:.12,memoryHealth01:.86,agency01:.78,externalInput:true,identityDecision:'allow',conflictPressure01:.2,dopamine01:.75,homeostaticPressure01:.1,homeostaticMode:'stable'};
const result=coordinator.integrateAndArbitrate({tick:1,at:Date.now(),observationId:'b209',...commonSignals, candidates:baseCandidates.map(c=>({...c,salience01:c.score}))},commonSignals,baseCandidates.map(c=>({...c,source:'world'})),null);
assert.equal(result.cerebellar.version,1);
assert.equal(result.computePlan.maxCandidates <= 12,true);
assert.ok(result.p61.integration01>=0 && result.p64.integration01>=0);
assert.ok(result.basalGanglia.selectedAction);
coordinator.recordOutcome(result.basalGanglia.selectedAction,.6,.88,.62,2);
const snap=coordinator.snapshot();
const restoredCoordinator=new CognitiveKernelCoordinator(new P61IntegratedMindKernel(),new P64IntegratedOrganismDynamics());
restoredCoordinator.restore({basalGanglia:snap.basalGanglia,cerebellar:snap.cerebellar,computeGovernor:snap.computeGovernor});
assert.equal(restoredCoordinator.snapshot().cerebellar.outcomeUpdates,snap.cerebellar.outcomeUpdates);
assert.equal(restoredCoordinator.snapshot().computeGovernor.cycles,snap.computeGovernor.cycles);

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<4;i++){ await core.observe({text:`b209 ${i}`,worldContext:{location:'lab',facts:['predictive control'],objects:[]},novelty:.35}); await core.feedback({success:.82,reward:.88,surprise:.38}); }
const beforeCore=core.cognitiveKernelSnapshot();
assert.ok(beforeCore.cerebellar.cycles>=1);
assert.ok(beforeCore.cerebellar.outcomeUpdates>=1,'Core must feed real outcomes into cerebellar learning');
assert.ok(beforeCore.computeGovernor.cycles>=1);
const core2=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core2.init();
const afterCore=core2.cognitiveKernelSnapshot();
assert.equal(afterCore.cerebellar.outcomeUpdates,beforeCore.cerebellar.outcomeUpdates);
assert.equal(afterCore.computeGovernor.cycles,beforeCore.computeGovernor.cycles);
assert.equal(afterCore.basalGanglia.cycles,beforeCore.basalGanglia.cycles);

console.log(JSON.stringify({
  pass:'BIG_PASS_209_CEREBELLUM_SPARSE',
  cerebellarInitialError:before,
  cerebellarFinalError:after,
  cerebellarImproved:after<before,
  lesionedCorrection:lesioned.rows[0].correction01,
  richBudget01:rich.budget01,
  scarceBudget01:scarce.budget01,
  richMaxCandidates:rich.maxCandidates,
  scarceMaxCandidates:scarce.maxCandidates,
  richWorkSaved01:rich.estimatedWorkSaved01,
  scarceWorkSaved01:scarce.estimatedWorkSaved01,
  coordinatorComputeBudget01:result.computePlan.budget01,
  coordinatorCandidatesProcessed:result.p61.candidateScores?Object.keys(result.p61.candidateScores).length:null,
  coreCerebellarOutcomeUpdates:beforeCore.cerebellar.outcomeUpdates,
  coreRestore:'PASS',
  verified:true
},null,2));
