import assert from 'node:assert/strict';
import { B285NeuralLifeConsolidationCore } from '../src/organism/cognition/B285NeuralLifeConsolidationCore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const contextA='e3|c1|u2|n1|g1|s1';
const contextB='e3|c1|u3|n2|g1|s1';
const obs={embodiment:{bodyEnergy01:.92,cognitiveCapacity01:.90,thermalStrain01:.13,sensoryFreshness01:.86,battery01:.90,cpuLoad01:.18,ramPressure01:.18,awake:true},novelty:.44,surprise:.10};
const world=(tick,action,reward,context)=>({action,before:{tick,location:`b316-${context}`,energy:.82,attention:.80,uncertainty:.44,facts:[`${action}-probe`],objects:[],events:[]},after:{tick:tick+1,location:`b316-${context}`,energy:.79,attention:.77,uncertainty:reward>.55?.24:.80,facts:[`${action}-probe`,`context-${context}`],objects:[],events:['verified-transition']},reward,surprise:reward>.55?.06:.68,at:700000+tick});

// 1) Canonical B285: contextual scar must be action-selective.
const life=new B285NeuralLifeConsolidationCore();
life.setScarContext(contextA);
for(let i=0;i<48;i++){
  life.step({tick:i,identityLatent:Array(24).fill(.02),selfLatent:Array(24).fill(.01),worldLatent:Array(24).fill(-.03),goalVector:Array(24).fill(.02),memoryLatent:Array(24).fill(.01),relationshipVector:Array(24).fill(.02),relationshipId:'life-general',personalityVector:Array(24).fill(0),reward01:.04,predictionError01:.72,agency01:.65,learningEnabled:true,importance01:.92});
  life.recordNegativeOutcome({tick:i,action:'respond',severity01:.94,evidence01:.96,verified:true,predictionError01:.84,importance01:.93});
}
const trained=life.diagnostics();
const sourceBias=life.actionBias('respond');
const unrelatedBias=life.actionBias('explore');
const sourceActionScar=trained.scarContextStates[contextA]?.actionNegative01?.respond??0;
const unrelatedActionScar=trained.scarContextStates[contextA]?.actionNegative01?.explore??0;
assert.ok(trained.negativeScarCount===48,'B316 negative count mismatch');
assert.ok(sourceActionScar>.20,'B316 source action contextual scar did not consolidate');
assert.ok(unrelatedActionScar<.05,'B316 unrelated action inherited contextual scar');
assert.ok(sourceBias<unrelatedBias,'B316 context did not suppress affected action selectively');

// 2) Neighbor transfer must remain bounded and action-selective.
life.setScarContext(contextB);
const neighborBias=life.actionBias('respond');
const neighborUnrelatedBias=life.actionBias('explore');
assert.ok(neighborBias<neighborUnrelatedBias,'B316 neighbor context lost action selectivity');
assert.ok(Math.abs(neighborBias)>=Math.abs(sourceBias)*.05,'B316 neighbor transfer vanished');
assert.ok(Math.abs(neighborBias)<Math.abs(sourceBias)*.999,'B316 neighbor transfer became indistinguishable from source');

// 3) Corrective evidence for the same action should reduce the contextual action scar.
life.setScarContext(contextA);
const beforeRecovery=life.diagnostics().scarContextStates[contextA]?.actionNegative01?.respond??0;
for(let i=48;i<72;i++) life.recordRecovery({tick:i,action:'respond',reward01:.95,correctiveEvidence01:.96,futureConsistency01:.92,verified:true});
const afterRecovery=life.diagnostics().scarContextStates[contextA]?.actionNegative01?.respond??0;
assert.ok(afterRecovery<beforeRecovery,'B316 same-action recovery did not weaken contextual scar');
assert.ok(afterRecovery>.01,'B316 recovery erased contextual action scar completely');

// 4) Restart must preserve the new additive state.
const restored=new B285NeuralLifeConsolidationCore();
restored.restore(life.snapshot());
const rd=restored.diagnostics();
assert.equal(rd.negativeScarCount,life.diagnostics().negativeScarCount,'B316 restart lost global scar');
assert.equal(rd.scarContextStates[contextA]?.count,life.diagnostics().scarContextStates[contextA]?.count,'B316 restart lost contextual count');
assert.ok(Math.abs((rd.scarContextStates[contextA]?.actionNegative01?.respond??0)-afterRecovery)<1e-12,'B316 restart lost action-specific scar');

// 5) Live OrganismCore integration must populate action-specific contextual scar, while B296 neural learning remains live.
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
for(let i=0;i<12;i++){
  const r=await core.observe({text:'b316 verified negative context',...obs});
  const action=r.decision?.selected?.action??'respond';
  await core.feedback({success:.04,reward:.03,surprise:.68,evidenceSource:'device',worldTransition:world(i,action,.03,'live')});
}
const live=core.b315ScarContextDiagnostics();
const liveContexts=Object.values(live.scarContextStates??{});
assert.ok(live.negativeScarCount>=12,'B316 live core scar count too low');
assert.ok(live.scarContextCount>=1,'B316 live core has no contextual scar');
assert.ok(liveContexts.some(c=>Object.values(c.actionNegative01??{}).some(v=>Number(v)>.01)),'B316 live core has no action-specific contextual scar');
const neural=core.b296NeuralPersonalityAgencyDiagnostics();
assert.ok(neural.learningUpdates>0,'B316 live integration did not reach B296 learning');
assert.ok(neural.synapticUpdates>0,'B316 live integration produced no synaptic updates');

console.log(JSON.stringify({
  pass:true,
  canonical:{negativeScarCount:trained.negativeScarCount,sourceActionScar,unrelatedActionScar,sourceBias,unrelatedBias,neighborBias,neighborUnrelatedBias,beforeRecovery,afterRecovery},
  restart:{contextCount:rd.scarContextCount,actionScar:rd.scarContextStates[contextA]?.actionNegative01?.respond??0},
  liveCore:{negativeScarCount:live.negativeScarCount,scarContextCount:live.scarContextCount,actionSpecificContextState:liveContexts.some(c=>Object.values(c.actionNegative01??{}).some(v=>Number(v)>.01)),b296LearningUpdates:neural.learningUpdates,b296SynapticUpdates:neural.synapticUpdates}
},null,2));
process.exit(0);
