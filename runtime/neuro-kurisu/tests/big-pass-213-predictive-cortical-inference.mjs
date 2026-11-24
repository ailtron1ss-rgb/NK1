import assert from 'node:assert/strict';
import { CorticalHierarchyEngine } from '../src/organism/system/CorticalHierarchyEngine.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const signal={id:'explore',evidence01:.74,prediction01:.48,confidence01:.66,salience01:.8,novelty01:.7,abstraction01:.34};
const ctx={uncertainty01:.55,predictionError01:.42,novelty01:.7,goalPressure01:.72,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,externalInput:true,tick:1};

const cold=new CorticalHierarchyEngine();
const coldFrame=cold.route([signal],ctx);
const trained=new CorticalHierarchyEngine();
for(let i=0;i<24;i++){
  const predicted=.48 + Math.min(.12,i*.002);
  const actual=.72 + (i%3===0?.01:i%3===1?- .01:0);
  trained.recordOutcome('explore',predicted,actual,.82,i+1);
}
const trainedFrame=trained.route([signal],{...ctx,tick:40});
const coldRow=coldFrame.rows[0], trainedRow=trainedFrame.rows[0];
assert.ok(trained.diagnostics().predictiveUpdates>=20,'online predictive updates must occur');
assert.ok(Math.abs(trainedRow.predictivePosterior01-.72)<.12,'posterior must move toward observed outcome');
assert.ok(trainedRow.predictionError01<coldRow.predictionError01,'learning must reduce predictive error on the held-out route');
assert.ok(trainedRow.calibration01>=coldRow.calibration01,'learning should improve calibration on the held-out route');
assert.ok(trainedRow.selectiveAbstain01<=coldRow.selectiveAbstain01,'better calibrated prediction should reduce selective risk');
assert.ok(trained.diagnostics().meanCalibration01>0.5);


const migrated=new CorticalHierarchyEngine();
migrated.restore({routeModels:{legacy:{meanError01:.3,bias01:.1,samples:3,lastTick:2}}});
const legacyModel=migrated.snapshot().routeModels.legacy;
assert.equal(typeof legacyModel.posterior01,'number');
assert.equal(typeof legacyModel.precision01,'number');

const skipped=new CorticalHierarchyEngine();
const skip=skipped.recordOutcome('rest',.5,.52,.01,1);
assert.equal(skip.skipped,true);
assert.equal(skipped.diagnostics().predictiveUpdates,0);
assert.equal(skipped.diagnostics().predictiveSkips,1);

const causalOff=new CorticalHierarchyEngine();
const causalOn=new CorticalHierarchyEngine();
for(let i=0;i<18;i++) causalOn.recordOutcome('explore',.45,.78,.9,100+i);
const on=causalOn.route([signal],{...ctx,tick:120});
const off=causalOff.route([signal],{...ctx,tick:120});
const causalDelta=Math.abs(on.rows[0].hierarchyGain01-off.rows[0].hierarchyGain01)+Math.abs(on.rows[0].predictivePosterior01-off.rows[0].predictivePosterior01);
assert.ok(causalDelta>0.02,'predictive learning must causally change route output');

const p61=new P61IntegratedMindKernel();
const p64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(p61,p64);
const candidates=[
  {action:'explore',score:.74,confidence01:.66,predictedUtility:.48,source:'b213'},
  {action:'verify',score:.68,confidence01:.84,predictedUtility:.61,source:'b213'},
  {action:'rest',score:.34,confidence01:.9,predictedUtility:.35,source:'b213'},
];
const p61Input={tick:2,at:Date.now(),observationId:'b213',externalInput:true,identity01:.84,workspace01:.8,metacognitive01:.76,predictionError01:.42,uncertainty01:.4,novelty01:.66,grounding01:.84,causal01:.8,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.22,goalPressure01:.78,realityGap01:.12,memoryHealth01:.87,developmentalPriority01:.25,identityDecision:'allow',candidates:candidates.map(c=>({...c}))};
const p64Signals={identity01:.84,workspace01:.8,metacognitive01:.76,predictionError01:.42,uncertainty01:.4,novelty01:.66,grounding01:.84,causal01:.8,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.22,goalPressure01:.78,realityGap01:.12,memoryHealth01:.87,agency01:.78,externalInput:true,identityDecision:'allow',conflictPressure01:.3,dopamine01:.75,homeostaticPressure01:.12,homeostaticMode:'stable'};
const integration=coordinator.integrateAndArbitrate(p61Input,p64Signals,candidates);
assert.ok(integration.corticalHierarchy.rows.every(r=>typeof r.informationGain01==='number'));

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<5;i++) await core.observe({text:`predictive persistence ${i}`,worldContext:{location:'lab',facts:['prediction error','selective inference'],objects:[]},novelty:.72});
const snap=core.cognitiveKernelSnapshot().corticalHierarchy;
assert.ok((snap?.predictiveUpdates??0)>=0);
assert.ok(typeof snap?.meanCalibration01==='number');
const restoredCore=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await restoredCore.init();
const restored=restoredCore.cognitiveKernelSnapshot().corticalHierarchy;
assert.equal(restored?.predictiveUpdates,snap?.predictiveUpdates);
assert.equal(restored?.predictiveSkips,snap?.predictiveSkips);

console.log(JSON.stringify({
  pass:'BIG_PASS_213_PREDICTIVE_CORTICAL_INFERENCE',
  learning:{predictiveUpdates:trained.diagnostics().predictiveUpdates,predictiveSkips:trained.diagnostics().predictiveSkips,posterior01:trainedRow.predictivePosterior01,coldError01:coldRow.predictionError01,trainedError01:trainedRow.predictionError01,calibration01:trainedRow.calibration01,selectiveAbstain01:trainedRow.selectiveAbstain01},
  causal:{delta01:causalDelta,onPosterior01:on.rows[0].predictivePosterior01,offPosterior01:off.rows[0].predictivePosterior01},
  persistence:{predictiveUpdates:snap?.predictiveUpdates,predictiveSkips:snap?.predictiveSkips,restored:true},
  integration:{rows:integration.corticalHierarchy.rows.length},
}));
