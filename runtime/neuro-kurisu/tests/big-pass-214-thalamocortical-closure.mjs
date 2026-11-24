import assert from 'node:assert/strict';
import { ThalamocorticalGate } from '../src/organism/system/ThalamocorticalGate.ts';
import { ArtificialBrainAtlas } from '../src/organism/system/ArtificialBrainAtlas.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const baseInput={
  bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,uncertainty01:.48,
  predictionError01:.5,grounding01:.84,causal01:.8,metacognitive01:.76,memoryHealth01:.87,
  goalPressure01:.78,socialNeed01:.22,novelty01:.7,externalInput:true,identityDecision:'allow'
};
const rows=[
  {id:'explore',precision01:.92,contradiction01:.08,informationGain01:.72,predictivePosterior01:.79,predictionError01:.12},
  {id:'verify',precision01:.7,contradiction01:.62,informationGain01:.2,predictivePosterior01:.46,predictionError01:.58},
  {id:'rest',precision01:.86,contradiction01:.1,informationGain01:.05,predictivePosterior01:.65,predictionError01:.1},
];

const gate=new ThalamocorticalGate();
const pre=gate.gate(baseInput);
const closed=gate.closeLoop(pre,rows,10);
assert.equal(closed.loopClosed,true);
assert.ok(closed.reason.includes('cortical-feedback'));
assert.ok(Math.abs(closed.channelGain.action-pre.channelGain.action)>0.0001 || Math.abs(closed.channelGain.research-pre.channelGain.research)>0.0001,'cortical feedback must causally adjust thalamic routing');
assert.ok(closed.loopGain01>=0&&closed.loopGain01<=1);
assert.ok(closed.loopError01>=0&&closed.loopError01<=1);

const hostile=gate.closeLoop(pre,rows.map(r=>({...r,precision01:.18,contradiction01:.96,informationGain01:.01,predictionError01:.95})),11);
assert.ok(hostile.channelGain.action <= closed.channelGain.action + .12,'runaway feedback must remain bounded');
assert.ok(Math.abs(hostile.channelGain.action-pre.channelGain.action)<=pre.channelGain.action*.19+.02,'one noisy feedback frame must not seize control');

for(let i=0;i<14;i++) gate.recordOutcome('explore',.48,.82,.82,20+i);
const learned=gate.snapshot().channelModels.action;
assert.ok(learned.samples>=14);
assert.ok(learned.posterior01>.5);
assert.ok(learned.precision01>.5);

const restored=new ThalamocorticalGate();
restored.restore(gate.snapshot());
assert.deepEqual(restored.snapshot().channelModels,gate.snapshot().channelModels);
assert.equal(restored.snapshot().closedLoops,gate.snapshot().closedLoops);

const atlas=new ArtificialBrainAtlas();
const thalamus=atlas.get('thalamus.gateway');
assert.ok(thalamus?.currentOwners.includes('ThalamocorticalGate'));

const p61=new P61IntegratedMindKernel();
const p64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(p61,p64);
const candidates=[
 {action:'explore',score:.74,confidence01:.7,predictedUtility:.76,source:'b214'},
 {action:'verify',score:.64,confidence01:.8,predictedUtility:.55,source:'b214'},
 {action:'rest',score:.32,confidence01:.92,predictedUtility:.4,source:'b214'},
];
const p61Input={...baseInput,tick:30,at:Date.now(),observationId:'b214',identity01:.84,workspace01:.8,realityGap01:.12,developmentalPriority01:.25,candidates:candidates.map(c=>({...c}))};
const p64Signals={...baseInput,identity01:.84,workspace01:.8,realityGap01:.12,agency01:.78,conflictPressure01:.3,dopamine01:.75,homeostaticPressure01:.12,homeostaticMode:'stable'};
const integration=coordinator.integrateAndArbitrate(p61Input,p64Signals,candidates);
assert.equal(integration.thalamus.loopClosed,true);
assert.ok(integration.corticalHierarchy.rows.length===3);
assert.ok(integration.candidates.every(c=>c.score>=0&&c.score<=1));
const coordinatorSnapshot=coordinator.snapshot();
assert.ok(coordinatorSnapshot.thalamus.closedLoops>=1);

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<4;i++) await core.observe({text:`thalamocortical closure ${i}`,worldContext:{location:'lab',facts:['routing feedback','uncertainty'],objects:[]},novelty:.74});
const coreSnap=core.cognitiveKernelSnapshot().thalamus;
assert.ok(coreSnap?.closedLoops>=1,'core must persist closed-loop thalamic cycles');
assert.ok(coreSnap?.channelModels?.action);
const restoredCore=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await restoredCore.init();
const restoredCoreSnap=restoredCore.cognitiveKernelSnapshot().thalamus;
assert.equal(restoredCoreSnap?.closedLoops,coreSnap?.closedLoops);
assert.deepEqual(restoredCoreSnap?.channelModels,coreSnap?.channelModels);

console.log(JSON.stringify({
 pass:'BIG_PASS_214_THALAMOCORTICAL_CLOSURE',
 causal:{preAction01:pre.channelGain.action,closedAction01:closed.channelGain.action,preResearch01:pre.channelGain.research,closedResearch01:closed.channelGain.research,loopGain01:closed.loopGain01,loopError01:closed.loopError01},
 boundedFeedback:{hostileAction01:hostile.channelGain.action,maxAllowed01:pre.channelGain.action*.19+.02},
 learning:{actionPosterior01:learned.posterior01,actionPrecision01:learned.precision01,samples:learned.samples},
 integration:{loopClosed:integration.thalamus.loopClosed,closedLoops:coordinatorSnapshot.thalamus.closedLoops},
 persistence:{closedLoops:coreSnap?.closedLoops,restored:true},
 verified:true
},null,2));
