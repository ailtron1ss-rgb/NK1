import assert from 'node:assert/strict';
import { B285NeuralLifeConsolidationCore } from '../src/organism/cognition/B285NeuralLifeConsolidationCore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const obs={embodiment:{bodyEnergy01:.91,cognitiveCapacity01:.90,thermalStrain01:.14,sensoryFreshness01:.86,battery01:.88,cpuLoad01:.18,ramPressure01:.18,awake:true},novelty:.42,surprise:.10};
const world=(tick,action,reward,branch)=>({action,before:{tick,location:`b315-${branch}`,energy:.82,attention:.8,uncertainty:.44,facts:[`${action}-probe`],objects:[],events:[]},after:{tick:tick+1,location:`b315-${branch}`,energy:.80,attention:.79,uncertainty:reward>.55?.24:.80,facts:[`${action}-probe`,`branch-${branch}`],objects:[],events:['verified-transition']},reward,surprise:reward>.55?.06:.68,at:300000+tick});

// Long-horizon canonical B285 evolution: no socket/runtime harness, same owner that live OrganismCore uses.
const life=new B285NeuralLifeConsolidationCore();
life.setScarContext('e3|c1|u2|n1|g1|s1');
for(let i=0;i<40;i++){
  life.step({tick:i,identityLatent:Array(24).fill(.02),selfLatent:Array(24).fill(.01),worldLatent:Array(24).fill(i<20?-.03:.01),goalVector:Array(24).fill(.02),memoryLatent:Array(24).fill(.01),relationshipVector:Array(24).fill(.02),relationshipId:'life-general',personalityVector:Array(24).fill(0),reward01:.04,predictionError01:.72,agency01:.65,learningEnabled:true,importance01:.91});
  life.recordNegativeOutcome({tick:i,action:'respond',severity01:.92,evidence01:.95,verified:true,predictionError01:.82,importance01:.90});
}
const harmed=life.diagnostics();
assert.ok(harmed.negativeScarCount>=40,'B315 canonical long-horizon scar count too low');
assert.ok(harmed.scarContextCount>=1,'B315 context scar state missing');
assert.ok(harmed.negativeScar01>.30,'B315 long-horizon scar did not consolidate');
const scarContextBefore=harmed.scarContextStates['e3|c1|u2|n1|g1|s1'];
assert.ok(scarContextBefore && scarContextBefore.negative01>.20,'B315 context-specific scar stayed weak');
const scarActionBeforeRecoveryLong=scarContextBefore?.actionNegative01?.respond??0;
assert.ok(scarActionBeforeRecoveryLong>.20,'B316 action-specific contextual scar stayed weak');
assert.ok((scarContextBefore.actionNegative01?.respond??0)>.20,'B316 action-specific contextual scar stayed weak');
assert.ok((scarContextBefore.actionNegative01?.explore??0)<.05,'B316 unrelated action inherited too much contextual scar');
for(let i=40;i<72;i++){
  life.recordRecovery({tick:i,action:'respond',reward01:.95,correctiveEvidence01:.95,futureConsistency01:.92,verified:true});
}
const recovered=life.diagnostics();
assert.ok(recovered.recoveryCount>=32,'B315 recovery did not accumulate');
assert.ok(recovered.negativeScar01<harmed.negativeScar01,'B315 recovery failed to weaken long-horizon scar');
assert.ok(recovered.negativeScar01>.05,'B315 recovery erased scar too aggressively');
// Neighbor-context transfer must be bounded, not identical to source context.
life.setScarContext('e3|c1|u2|n2|g1|s1');
const sourceBias=life.actionBias('respond');
const unrelatedBias=life.actionBias('explore');
assert.ok(sourceBias<0,'B315 source context scar did not suppress action');
assert.ok(sourceBias<unrelatedBias,'B316 contextual scar is not action-selective');
life.setScarContext('e3|c1|u3|n2|g1|s1');
const neighborBias=life.actionBias('respond');
const neighborUnrelatedBias=life.actionBias('explore');
assert.ok(neighborBias<=0,'B315 neighbor context unexpectedly amplified scar positive');
assert.ok(neighborBias<neighborUnrelatedBias,'B316 neighbor transfer is not action-selective');
assert.ok(Math.abs(neighborBias)>=Math.abs(sourceBias)*.05,'B315 neighbor context received no bounded scar transfer');
const scarBeforeRecovery=life.diagnostics().scarContextStates['e3|c1|u2|n1|g1|s1'];
assert.ok((scarBeforeRecovery?.actionNegative01?.respond??0)>=0,'B316 contextual scar state missing after long-horizon recovery');
life.setScarContext('e3|c1|u2|n1|g1|s1');
life.recordRecovery({tick:73,action:'respond',reward01:.95,correctiveEvidence01:.95,futureConsistency01:.92,verified:true});
const scarAfterRecovery=life.diagnostics().scarContextStates['e3|c1|u2|n1|g1|s1'];
assert.ok((scarAfterRecovery?.actionNegative01?.respond??0)<(scarBeforeRecovery?.actionNegative01?.respond??1),'B316 selected contextual scar did not recover');

// Short live OrganismCore integration: context state must actually be populated by feedback.
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
for(let i=0;i<8;i++){
  const r=await core.observe({text:'b315 verified negative experience',...obs});
  await core.feedback({success:.04,reward:.03,surprise:.68,evidenceSource:'device',worldTransition:world(i,r.decision?.selected?.action??'respond',.03,'live')});
}
const live=core.b315ScarContextDiagnostics();
assert.ok(live.negativeScarCount>0,'B315 live core context scar did not update');
assert.ok(live.scarContextCount>0,'B315 live core did not populate context scar map');
console.log(JSON.stringify({pass:true,longHorizon:{negativeScarCount:harmed.negativeScarCount,scar01BeforeRecovery:harmed.negativeScar01,scar01AfterRecovery:recovered.negativeScar01,recoveryCount:recovered.recoveryCount,scarContextCount:recovered.scarContextCount,sourceBias,unrelatedBias,neighborBias,neighborUnrelatedBias,actionScarBeforeRecoveryLong:scarActionBeforeRecoveryLong,actionScarBeforeRecovery:scarBeforeRecovery?.actionNegative01?.respond??0,actionScarAfterRecovery:scarAfterRecovery?.actionNegative01?.respond??0},liveCore:{negativeScarCount:live.negativeScarCount,scarContextCount:live.scarContextCount}},null,2));
process.exit(0);
