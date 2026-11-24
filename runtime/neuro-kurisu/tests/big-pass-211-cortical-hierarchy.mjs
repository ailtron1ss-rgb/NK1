import assert from 'node:assert/strict';
import { CorticalHierarchyEngine } from '../src/organism/system/CorticalHierarchyEngine.ts';
import { ArtificialBrainAtlas } from '../src/organism/system/ArtificialBrainAtlas.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const signals=[
  {id:'explore',evidence01:.78,prediction01:.82,confidence01:.72,salience01:.84,novelty01:.82,abstraction01:.34},
  {id:'verify',evidence01:.66,prediction01:.64,confidence01:.84,salience01:.72,novelty01:.42,abstraction01:.58},
  {id:'rest',evidence01:.36,prediction01:.32,confidence01:.92,salience01:.28,novelty01:.06,abstraction01:.18},
  {id:'wait',evidence01:.41,prediction01:.35,confidence01:.79,salience01:.33,novelty01:.12,abstraction01:.46},
];

const engine=new CorticalHierarchyEngine();
const deep=engine.route(signals,{
  uncertainty01:.82,predictionError01:.74,novelty01:.78,goalPressure01:.82,
  bodyEnergy01:.88,thermal01:.08,cognitiveCapacity01:.92,memoryPressure01:.18,externalInput:true,tick:10,
});
assert.ok(deep.depthUsed>=5);
assert.equal(deep.routeMode,'deep');
assert.ok(deep.rows.every(r=>r.depthUsed===deep.depthUsed));
assert.ok(deep.meanPrecision01>=0 && deep.meanPrecision01<=1);

const shallow=engine.route(signals,{
  uncertainty01:.12,predictionError01:.08,novelty01:.06,goalPressure01:.14,
  bodyEnergy01:.24,thermal01:.82,cognitiveCapacity01:.30,memoryPressure01:.74,externalInput:false,tick:11,
});
assert.ok(shallow.depthUsed<=2);
assert.equal(shallow.routeMode,'shallow');
assert.ok(shallow.depthUsed < deep.depthUsed);

const contradictorySignals=signals.map(s=>({...s,prediction01:s.id==='explore'?.08:s.prediction01}));
const contradiction=engine.route(contradictorySignals,{
  uncertainty01:.88,predictionError01:.86,novelty01:.7,goalPressure01:.78,
  bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,externalInput:true,tick:12,
});
const normalExplore=deep.rows.find(r=>r.id==='explore');
const badExplore=contradiction.rows.find(r=>r.id==='explore');
assert.ok((badExplore?.contradiction01??0) > (normalExplore?.contradiction01??0));
assert.ok((badExplore?.hierarchyGain01??1) < (normalExplore?.hierarchyGain01??1));

const learnedBefore=engine.snapshot().routeModels.explore?.meanError01 ?? .5;
for(let i=0;i<16;i++) engine.recordOutcome('explore',.78,.94,.82,20+i);
const learnedAfter=engine.snapshot().routeModels.explore?.meanError01 ?? .5;
assert.ok(engine.snapshot().routeModels.explore.samples===16);
assert.notEqual(learnedAfter, learnedBefore);

const restoredEngine=new CorticalHierarchyEngine();
restoredEngine.restore(engine.snapshot());
assert.deepEqual(restoredEngine.snapshot().routeModels,engine.snapshot().routeModels);
assert.equal(restoredEngine.snapshot().cycles,engine.snapshot().cycles);

const atlas=new ArtificialBrainAtlas();
const cortex=atlas.get('cortex.association');
assert.ok(cortex?.currentOwners.includes('CorticalHierarchyEngine'));
assert.ok(atlas.edgesFor('cortex.association').some(e=>e.from==='cortex.association'&&e.to==='cortex.association'&&e.evidenceLevel==='implemented'));

const p61=new P61IntegratedMindKernel();
const p64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(p61,p64);
const candidates=[
  {action:'explore',score:.78,confidence01:.72,predictedUtility:.82,source:'world'},
  {action:'verify',score:.66,confidence01:.84,predictedUtility:.64,source:'research'},
  {action:'rest',score:.36,confidence01:.92,predictedUtility:.32,source:'body'},
  {action:'wait',score:.41,confidence01:.79,predictedUtility:.35,source:'world'},
];
const p61Input={tick:10,at:Date.now(),observationId:'b211',externalInput:true,identity01:.84,workspace01:.78,metacognitive01:.74,predictionError01:.52,uncertainty01:.36,novelty01:.72,grounding01:.84,causal01:.79,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.24,goalPressure01:.8,realityGap01:.12,memoryHealth01:.87,developmentalPriority01:.25,identityDecision:'allow',candidates:candidates.map(c=>({...c}))};
const p64Signals={identity01:.84,workspace01:.78,metacognitive01:.74,predictionError01:.52,uncertainty01:.36,novelty01:.72,grounding01:.84,causal01:.79,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.24,goalPressure01:.8,realityGap01:.12,memoryHealth01:.87,agency01:.78,externalInput:true,identityDecision:'allow',conflictPressure01:.2,dopamine01:.78,homeostaticPressure01:.1,homeostaticMode:'stable'};
const integration=coordinator.integrateAndArbitrate(p61Input,p64Signals,candidates);
assert.ok(integration.corticalHierarchy.rows.length===candidates.length);
assert.ok(integration.corticalHierarchy.layers.length===integration.corticalHierarchy.depthUsed);
assert.ok(integration.candidates.some(c=>c.action==='explore'));
assert.ok(coordinator.snapshot().corticalHierarchy.cycles>=1);

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<4;i++) await core.observe({text:`cortical hierarchy persistence ${i}`,worldContext:{location:'lab',facts:['prediction routing'],objects:[]},novelty:.7});
const coreCortical=core.cognitiveKernelSnapshot().corticalHierarchy;
assert.ok(coreCortical?.cycles>=1,'core must execute cortical hierarchy');
assert.ok(Object.keys(coreCortical?.layers ?? {}).length>=1);
const restoredCore=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await restoredCore.init();
const restoredCoreCortical=restoredCore.cognitiveKernelSnapshot().corticalHierarchy;
assert.equal(restoredCoreCortical?.cycles,coreCortical?.cycles,'cortical hierarchy cycles must survive restart');
assert.deepEqual(restoredCoreCortical?.routeModels,coreCortical?.routeModels,'cortical learned routing must survive restart');

console.log(JSON.stringify({
  pass:'BIG_PASS_211_CORTICAL_HIERARCHY',
  deep:{depthUsed:deep.depthUsed,mode:deep.routeMode,coherence01:deep.globalCoherence01,contradiction01:deep.globalContradiction01},
  shallow:{depthUsed:shallow.depthUsed,mode:shallow.routeMode},
  contradiction:{exploreGain:badExplore?.hierarchyGain01,normalGain:normalExplore?.hierarchyGain01,exploreContradiction:badExplore?.contradiction01},
  learning:{samples:engine.snapshot().routeModels.explore.samples,meanError01:learnedAfter},
  atlas:{cortexOwners:cortex?.currentOwners.length ?? 0,selfPredictiveEdge:atlas.edgesFor('cortex.association').some(e=>e.from==='cortex.association'&&e.to==='cortex.association'&&e.evidenceLevel==='implemented')},
  integration:{corticalCycles:coordinator.snapshot().corticalHierarchy.cycles,depth:integration.corticalHierarchy.depthUsed,routeMode:integration.corticalHierarchy.routeMode},
  persistence:{coreCycles:coreCortical?.cycles,restore:'PASS'},
  verified:true
},null,2));
