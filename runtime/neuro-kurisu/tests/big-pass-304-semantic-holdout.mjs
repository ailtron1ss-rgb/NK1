import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
await core.beginBatch();
core.b304SemanticHoldoutSetPhase('training','B304 training semantic families');
const timings=[]; let full=0,micro=0,verified=0;
const trainingFamilies=['evidence-verification','exploratory-planning','reflective-recovery'];
const holdoutFamilies=['social-negotiation','resource-tradeoff','surprise-coordination'];
for(let i=0;i<128;i++){
  const holdout=i>=80;
  if(i===80) core.b304SemanticHoldoutSetPhase('holdout','hidden semantic task families');
  const family=holdout?holdoutFamilies[Math.floor((i-80)/16)%holdoutFamilies.length]:trainingFamilies[Math.floor(i/27)%trainingFamilies.length];
  const text=holdout
    ? `Solve an unfamiliar ${family.replaceAll('-',' ')} situation without copying prior wording.`
    : `Practice ${family.replaceAll('-',' ')} while keeping evidence and consequences explicit.`;
  const highPressure=holdout&&i>=112;
  const body={bodyEnergy01:highPressure?.62:.84,cognitiveCapacity01:highPressure?.70:.86,thermalStrain01:highPressure?.74:.18,sensoryFreshness01:.86-(i%11)*.01,awake:true,battery01:highPressure?.31:.82,cpuLoad01:highPressure?.82:.22,ramPressure01:highPressure?.86:.18};
  const forceFull=(i<64&&i%2===0)||(holdout&&i%3===0);
  const input=forceFull?{text,novelty:holdout?.80:.34,surprise:holdout?.62:.14,embodiment:body}:{embodiment:body};
  const t=performance.now();
  const result=await core.observeOperational(input);
  timings.push(performance.now()-t);
  if(result.workspace.content.temporalResolution==='micro') micro++; else full++;
  const action=result.decision?.selected?.action??'wait';
  if(result.workspace.content.temporalResolution==='micro') continue;
  const reward=holdout
    ? (family==='social-negotiation'?(action==='respond'?.72:action==='verify'?.65:.54):family==='resource-tradeoff'?(action==='defer'?.70:action==='rest'?.68:action==='verify'?.63:.51):(action==='reflect'?.71:action==='verify'?.66:.52))
    : (action==='verify'?.73:action==='explore'?.74:action==='reflect'?.69:action==='rest'?.68:.52);
  const world=(holdout&&i%4===0)?{
    action,before:{tick:i,location:'semantic-holdout',energy:.82,attention:.74,uncertainty:.64,facts:[`h-${family}-${i}`],objects:[],events:[`before-${i}`]},
    after:{tick:i+1,location:'semantic-holdout',energy:.75,attention:.81,uncertainty:.31,facts:[`h-${family}-${i}`,`verified-${i}`],objects:[],events:[`before-${i}`,`after-${i}`]},
    reward,surprise:input.surprise,at:Date.now()
  }:undefined;
  if(world) verified++;
  await core.feedback({success:reward,reward,surprise:input.surprise,evidenceSource:world?'external':'unknown',worldTransition:world,evaluationContextFamily:family,evaluationPhase:holdout?'holdout':'training',notes:`B304:${family}`});
}
const before=core.b304SemanticHoldoutDiagnostics();
const b296=core.b296NeuralPersonalityAgencyDiagnostics();
const b302=core.b302LongHorizonDiagnostics();
assert.ok(before.trainingPulses>=24,'B304 training full-pulse evidence too short');
assert.ok(before.holdoutPulses>=12,'B304 holdout full-pulse evidence too short');
assert.ok(before.trainingFamilyCount>=3,'B304 training semantic families collapsed');
assert.ok(before.holdoutFamilyCount>=3,'B304 holdout semantic families collapsed');
assert.equal(before.novelHoldoutFamilyRate01,1,'B304 holdout families were not semantically novel');
assert.ok(before.holdoutCoherence01>.30,'B304 holdout coherence too low');
assert.ok(before.familyTransferScore01>.15,'B304 family transfer too weak');
assert.ok(before.resourceBudgetCompliance01>.20,'B304 resource budget compliance too low');
assert.ok(before.evaluationReadiness01>.20,'B304 evaluation readiness too low');
assert.ok(b296.synapticUpdates>5000,'B304 neural plasticity evidence too small');
assert.ok(b302.verifiedUpdates>=4,'B304 causal verification too small');
assert.ok(full>=48,'B304 full cognitive pulses below target');
assert.ok(micro>0,'B304 governor did not produce any micro cycles');

const snap=core.snapshot();
await core.endBatch();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await restored.init();
const recovered=restored.b304SemanticHoldoutDiagnostics();
assert.equal(recovered.trainingPulses,before.trainingPulses,'B304 training lost after restart');
assert.equal(recovered.holdoutPulses,before.holdoutPulses,'B304 holdout lost after restart');
assert.equal(recovered.novelHoldoutFamilyRate01,1,'B304 novel family evidence changed after restart');

const mean=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
const sorted=[...timings].sort((a,b)=>a-b);
console.log(JSON.stringify({pass:true,ticks:128,trainingPulses:before.trainingPulses,holdoutPulses:before.holdoutPulses,trainingFamilyCount:before.trainingFamilyCount,holdoutFamilyCount:before.holdoutFamilyCount,novelHoldoutFamilyRate01:before.novelHoldoutFamilyRate01,holdoutCoherence01:before.holdoutCoherence01,familyTransferScore01:before.familyTransferScore01,resourceBudgetCompliance01:before.resourceBudgetCompliance01,evaluationReadiness01:before.evaluationReadiness01,full,micro,verified,meanCycleMs:mean(timings),p95CycleMs:sorted[Math.floor(sorted.length*.95)],b296:{learningUpdates:b296.learningUpdates,synapticUpdates:b296.synapticUpdates},b302:{verifiedUpdates:b302.verifiedUpdates,consolidationWindows:b302.consolidationWindows}},null,2));
process.exit(0);
