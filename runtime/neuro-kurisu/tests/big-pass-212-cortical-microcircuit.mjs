import assert from 'node:assert/strict';
import { CorticalHierarchyEngine } from '../src/organism/system/CorticalHierarchyEngine.ts';
import { ArtificialBrainAtlas } from '../src/organism/system/ArtificialBrainAtlas.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const signals=[
  {id:'explore',evidence01:.78,prediction01:.82,confidence01:.72,salience01:.88,novelty01:.76,abstraction01:.34},
  {id:'verify',evidence01:.68,prediction01:.63,confidence01:.84,salience01:.74,novelty01:.62,abstraction01:.58},
  {id:'rest',evidence01:.36,prediction01:.32,confidence01:.92,salience01:.28,novelty01:.12,abstraction01:.18},
  {id:'wait',evidence01:.41,prediction01:.35,confidence01:.79,salience01:.31,novelty01:.18,abstraction01:.46},
  {id:'inspect',evidence01:.72,prediction01:.54,confidence01:.61,salience01:.67,novelty01:.81,abstraction01:.72},
  {id:'recover',evidence01:.52,prediction01:.49,confidence01:.76,salience01:.83,novelty01:.43,abstraction01:.08},
];
const ctx={uncertainty01:.72,predictionError01:.58,novelty01:.67,goalPressure01:.74,bodyEnergy01:.86,thermal01:.12,cognitiveCapacity01:.91,memoryPressure01:.18,externalInput:true,tick:20};

const enabled=new CorticalHierarchyEngine();
const enabledFrame=enabled.route(signals,ctx);
assert.equal(enabledFrame.microcircuit.enabled,true);
assert.ok(enabledFrame.microcircuit.pvInhibition01>0);
assert.ok(enabledFrame.microcircuit.somInhibition01>0);
assert.ok(enabledFrame.rows.some(r=>r.sparsity01!==1));
assert.ok(enabledFrame.rows.every(r=>r.stability01>=0&&r.stability01<=1));

const disabled=new CorticalHierarchyEngine();
const disabledFrame=disabled.route(signals,{...ctx,microcircuitEnabled:false,tick:21});
assert.equal(disabledFrame.microcircuit.enabled,false);
const gainDiff=enabledFrame.rows.reduce((sum,r)=>sum+Math.abs(r.hierarchyGain01-(disabledFrame.rows.find(x=>x.id===r.id)?.hierarchyGain01??r.hierarchyGain01)),0);
assert.ok(gainDiff>0.01,'disabling the microcircuit must causally change candidate gains');
assert.ok(disabledFrame.rows.every(r=>r.microcircuitGain01===1));

const crowded=enabled.route([...signals,...signals.map((s,i)=>({...s,id:`dup-${i}`,evidence01:Math.max(.05,s.evidence01-.04)}))],{...ctx,tick:22});
const sparseSorted=[...crowded.rows].sort((a,b)=>b.sparsity01-a.sparsity01);
assert.ok(sparseSorted[0].sparsity01>sparseSorted.at(-1).sparsity01,'lateral competition must distinguish winners from redundant candidates');
assert.ok(crowded.microcircuit.sparsity01>0);

const unstableEngine=new CorticalHierarchyEngine();
const calmEngine=new CorticalHierarchyEngine();
const unstable=unstableEngine.route(signals.map(s=>({...s,prediction01:s.id==='explore'?.02:s.prediction01})),{...ctx,uncertainty01:.96,predictionError01:.98,novelty01:.9,tick:23});
const calm=calmEngine.route(signals,{...ctx,uncertainty01:.12,predictionError01:.06,novelty01:.04,tick:24});
assert.ok(unstable.microcircuit.recurrentBrake01>=calm.microcircuit.recurrentBrake01);
assert.ok(unstable.microcircuit.stability01<=calm.microcircuit.stability01);

const restored=new CorticalHierarchyEngine();
restored.restore(enabled.snapshot());
assert.deepEqual(restored.snapshot().microcircuit,enabled.snapshot().microcircuit);

const atlas=new ArtificialBrainAtlas();
const cortex=atlas.get('cortex.association');
assert.ok(cortex?.missingCapabilities.includes('biological cell-type/laminar mapping'));
assert.ok(!cortex?.missingCapabilities.includes('columnar microcircuits'));

const p61=new P61IntegratedMindKernel();
const p64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(p61,p64);
const candidates=signals.slice(0,4).map(s=>({action:s.id,score:s.evidence01,confidence01:s.confidence01,predictedUtility:s.prediction01,source:'b212'}));
const p61Input={tick:30,at:Date.now(),observationId:'b212',externalInput:true,identity01:.84,workspace01:.8,metacognitive01:.76,predictionError01:.58,uncertainty01:.42,novelty01:.66,grounding01:.84,causal01:.8,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.22,goalPressure01:.78,realityGap01:.12,memoryHealth01:.87,developmentalPriority01:.25,identityDecision:'allow',candidates:candidates.map(c=>({...c}))};
const p64Signals={identity01:.84,workspace01:.8,metacognitive01:.76,predictionError01:.58,uncertainty01:.42,novelty01:.66,grounding01:.84,causal01:.8,bodyEnergy01:.86,thermal01:.1,cognitiveCapacity01:.9,memoryPressure01:.2,socialNeed01:.22,goalPressure01:.78,realityGap01:.12,memoryHealth01:.87,agency01:.78,externalInput:true,identityDecision:'allow',conflictPressure01:.3,dopamine01:.75,homeostaticPressure01:.12,homeostaticMode:'stable'};
const integration=coordinator.integrateAndArbitrate(p61Input,p64Signals,candidates);
assert.ok(integration.corticalHierarchy.microcircuit.cycles>=1);
assert.ok(integration.candidates.some(c=>c.action==='explore'));

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<4;i++) await core.observe({text:`microcircuit persistence ${i}`,worldContext:{location:'lab',facts:['lateral inhibition','recurrent stability'],objects:[]},novelty:.72});
const snap=core.cognitiveKernelSnapshot().corticalHierarchy;
assert.ok(snap?.microcircuit?.cycles>=1);
assert.ok(typeof snap?.microcircuit?.recurrentBrake01==='number');
const restoredCore=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await restoredCore.init();
const restoredSnap=restoredCore.cognitiveKernelSnapshot().corticalHierarchy;
assert.equal(restoredSnap?.microcircuit?.cycles,snap?.microcircuit?.cycles);
assert.deepEqual(restoredSnap?.microcircuit, snap?.microcircuit);

console.log(JSON.stringify({
  pass:'BIG_PASS_212_CORTICAL_MICROCIRCUIT',
  causal:{gainDiff01:gainDiff,enabledPv:enabledFrame.microcircuit.pvInhibition01,enabledSom:enabledFrame.microcircuit.somInhibition01,disabledGainIsIdentity:disabledFrame.rows.every(r=>r.microcircuitGain01===1)},
  sparsity:{winner01:sparseSorted[0].sparsity01,loser01:sparseSorted.at(-1).sparsity01,spread01:sparseSorted[0].sparsity01-sparseSorted.at(-1).sparsity01},
  stability:{calm01:calm.microcircuit.stability01,unstable01:unstable.microcircuit.stability01,calmBrake01:calm.microcircuit.recurrentBrake01,unstableBrake01:unstable.microcircuit.recurrentBrake01},
  persistence:{cycles:snap?.microcircuit?.cycles,restore:'PASS'},
  verified:true
},null,2));
