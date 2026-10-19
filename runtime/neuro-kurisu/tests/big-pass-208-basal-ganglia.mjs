import assert from 'node:assert/strict';
import { BasalGangliaSelectionCircuit } from '../src/organism/system/BasalGangliaSelectionCircuit.ts';
import { ArtificialBrainAtlas } from '../src/organism/system/ArtificialBrainAtlas.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const candidates=[
  {action:'explore',corticalValue01:.78,predictedUtility01:.82,confidence01:.72,effort01:.45,conflict01:.25,goalFit01:.85,novelty01:.8},
  {action:'verify',corticalValue01:.61,predictedUtility01:.65,confidence01:.82,effort01:.25,conflict01:.22,goalFit01:.7,novelty01:.4},
  {action:'rest',corticalValue01:.36,predictedUtility01:.32,confidence01:.9,effort01:.05,conflict01:.08,goalFit01:.28,novelty01:.05},
  {action:'wait',corticalValue01:.4,predictedUtility01:.35,confidence01:.78,effort01:.08,conflict01:.32,goalFit01:.2,novelty01:.1},
];

const bg=new BasalGangliaSelectionCircuit();
const healthy=bg.route({candidates,dopamine01:.78,uncertainty01:.28,conflict01:.22,goalPressure01:.82,cognitiveCapacity01:.88,novelty01:.75,tick:1});
assert.equal(healthy.lesionApplied,false);
assert.ok(healthy.selectedAction);
assert.ok(healthy.actions.find(x=>x.action==='explore')?.direct01 > healthy.actions.find(x=>x.action==='explore')?.indirect01);

const learnedBefore=bg.snapshot().actionValues.explore??0;
for(let i=0;i<12;i++) bg.recordOutcome('explore',.94,.72,i+2,.8);
const learnedAfter=bg.snapshot().actionValues.explore??0;
assert.ok(learnedAfter > learnedBefore);

const conflict=bg.route({candidates,dopamine01:.18,uncertainty01:.82,conflict01:.88,goalPressure01:.45,cognitiveCapacity01:.45,novelty01:.3,tick:20});
assert.ok((conflict.actions.find(x=>x.action==='explore')?.hyperdirect01??0) > (healthy.actions.find(x=>x.action==='explore')?.hyperdirect01??0));
assert.ok((conflict.selectionMargin01) <= healthy.selectionMargin01 + .2);

bg.setLesion(true);
const lesion=bg.route({candidates,dopamine01:.18,uncertainty01:.82,conflict01:.88,goalPressure01:.45,cognitiveCapacity01:.45,novelty01:.3,tick:21});
assert.equal(lesion.lesionApplied,true);
assert.ok(Math.abs((lesion.actions.find(x=>x.action==='explore')?.gate01??0.5)-.5) < .08);
assert.ok(bg.diagnostics().lesionCycles>=1);

const restored=new BasalGangliaSelectionCircuit();
restored.restore(bg.snapshot());
assert.equal(restored.snapshot().cycles,bg.snapshot().cycles);
assert.deepEqual(restored.snapshot().actionValues,bg.snapshot().actionValues);

const atlas=new ArtificialBrainAtlas();
const basal=atlas.get('basal_ganglia.selection');
assert.ok(basal?.currentOwners.includes('BasalGangliaSelectionCircuit'));
assert.ok(atlas.edgesFor('basal_ganglia.selection').some(e=>e.evidenceLevel==='implemented'));

const p61=new P61IntegratedMindKernel();
const p64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(p61,p64);
const integrationCandidates=candidates.map(c=>({action:c.action,score:c.corticalValue01,confidence01:c.confidence01,predictedUtility:c.predictedUtility01,source:'world'}));
const integration=coordinator.integrateAndArbitrate(
  {tick:1,at:Date.now(),observationId:'b208',externalInput:true,identity01:.84,workspace01:.76,metacognitive01:.72,predictionError01:.44,uncertainty01:.28,novelty01:.75,grounding01:.84,causal01:.78,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.22,socialNeed01:.22,goalPressure01:.82,realityGap01:.12,memoryHealth01:.86,developmentalPriority01:.3,identityDecision:'allow',candidates:[...integrationCandidates]},
  {identity01:.84,workspace01:.76,metacognitive01:.72,predictionError01:.44,uncertainty01:.28,novelty01:.75,grounding01:.84,causal01:.78,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.22,socialNeed01:.22,goalPressure01:.82,realityGap01:.12,memoryHealth01:.86,agency01:.78,externalInput:true,identityDecision:'allow',conflictPressure01:.2,dopamine01:.8,homeostaticPressure01:.1,homeostaticMode:'stable'},
  integrationCandidates
);
assert.ok(integration.basalGanglia.selectedAction);
assert.ok(integration.basalGanglia.actions.length===candidates.length);
assert.ok(coordinator.snapshot().basalGanglia.cycles>=1);

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<3;i++) await core.observe({text:`bg persist ${i}`,worldContext:{location:'lab',facts:['candidate action observed'],objects:[]},novelty:.65});
const coreBg=core.cognitiveKernelSnapshot().basalGanglia;
assert.ok(coreBg.cycles>=1,'core must consume basal-ganglia gate');
const restoredCore=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await restoredCore.init();
const restoredCoreBg=restoredCore.cognitiveKernelSnapshot().basalGanglia;
assert.equal(restoredCoreBg.cycles,coreBg.cycles,'basal-ganglia cycle count must survive core restart');
assert.deepEqual(restoredCoreBg.actionValues,coreBg.actionValues,'basal-ganglia learned action values must survive core restart');

console.log(JSON.stringify({
  pass:'BIG_PASS_208_BASAL_GANGLIA',
  healthySelection:healthy.selectedAction,
  healthyMargin:healthy.selectionMargin01,
  conflictSelection:conflict.selectedAction,
  conflictHyperdirect01:conflict.hyperdirectBrake01,
  learnedExploreValue:learnedAfter,
  lesionGateExplore:lesion.actions.find(x=>x.action==='explore')?.gate01,
  coordinatorSelection:integration.basalGanglia.selectedAction,
  coreCycles:coreBg.cycles,
  coreRestore:'PASS',
  restore:'PASS',
  atlas:'PASS',
  verified:true
},null,2));
