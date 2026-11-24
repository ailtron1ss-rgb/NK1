import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
await core.beginBatch();
core.b303HoldoutSetPhase('training','B303 training phase');

const timings=[]; let full=0,micro=0,verified=0,autonomous=0;
for(let i=0;i<80;i++){
  const body={bodyEnergy01:.86-i*.0018,cognitiveCapacity01:.86,thermalStrain01:.18+(i%17)*.008,sensoryFreshness01:.88-(i%13)*.012,awake:true,battery01:.84-i*.0025,cpuLoad01:.20+(i%9)*.012,ramPressure01:.18+(i%11)*.01};
  const isHoldout=i>=60;
  if(i===60) core.b303HoldoutSetPhase('holdout','unseen context family');
  const prompt=!isHoldout
    ? (i<30?'Explore alternatives and preserve useful evidence.':i<60?'Verify beliefs and revise claims when evidence changes.':'Reflect on prior outcomes and select robust next actions.')
    : (i<101?'Handle an unfamiliar social-epistemic situation without copying the earlier wording.':i<114?'Resolve a novel resource-conflict while preserving causal evidence.':'Choose an unpractised response to a mixed autonomy-and-surprise situation.');
  const input=i%4===0
    ? {text:prompt,novelty:isHoldout?.82+(i%5)*.02:.32+(i%6)*.055,surprise:isHoldout?.68+(i%4)*.035:.12+(i%7)*.06,embodiment:body}
    : {embodiment:body};
  const t=performance.now(); const result=await core.observeOperational(input); timings.push(performance.now()-t);
  if(result.workspace.content.temporalResolution==='micro') micro++; else full++;
  const action=result.decision?.selected?.action ?? 'wait';
  const reward=isHoldout
    ? (action==='verify'?.70:action==='explore'?.74:action==='reflect'?.66:action==='rest'?.68:action==='respond'?.52:(i%3===0?.60:.40))
    : (action==='verify'?.72:action==='explore'?.76:action==='reflect'?.68:action==='rest'?.70:action==='respond'?.55:(i%2===0?.64:.42));
  const world = isHoldout && i%4===0 ? {
    action,
    before:{tick:i,location:'holdout-zone',energy:.82,attention:.71,uncertainty:.61,facts:[`holdout-belief-${i}`],objects:[{id:`hobj-${i}`,label:'novel-object',location:'holdout-zone',value:.61,visible:true,collected:false,confidence01:.59,evidenceKind:'observed'}],events:[`holdout-before-${i}`]},
    after:{tick:i+1,location:'holdout-zone',energy:.76,attention:.78,uncertainty:.31,facts:[`holdout-belief-${i}`,`holdout-verified-${i}`],objects:[{id:`hobj-${i}`,label:'novel-object',location:'holdout-zone',value:.73,visible:true,collected:true,confidence01:.89,evidenceKind:'observed'}],events:[`holdout-before-${i}`,`holdout-after-${i}`]},
    reward,surprise:input.surprise??.15,at:Date.now()
  } : undefined;
  if(world)verified++;
  const autonomousFlag=!Boolean(input.text);
  if(autonomousFlag) autonomous++;
  await core.feedback({success:reward,reward,surprise:input.surprise??.15,evidenceSource:world?'external':(i%17===0?'external':'unknown'),worldTransition:world});
}

const beforeRestart=core.b303HoldoutDiagnostics();
await core.endBatch();
const b296=core.b296NeuralPersonalityAgencyDiagnostics();
const b299=core.b299CausalPersonalityDiagnostics();
const b302=core.b302LongHorizonDiagnostics();
assert.equal(beforeRestart.holdoutPulses,20,'B303 holdout pulse count mismatch');
assert.ok(beforeRestart.trainingPulses>=40,'B303 training evidence too short');
assert.ok(beforeRestart.verifiedHoldoutUpdates>=5,'B303 holdout lacks verified world outcomes');
assert.ok(beforeRestart.unseenTransferScore01>0,'B303 unseen transfer score did not move');
assert.ok(beforeRestart.holdoutCoherence01>.35,'B303 holdout coherence too low');
assert.ok(beforeRestart.holdoutPolicyShift01>0,'B303 holdout policy shift missing');
assert.ok(beforeRestart.contextFingerprints.length>0,'B303 did not record context fingerprints');
assert.ok(beforeRestart.holdoutNovelContextRate01>=.50,'B303 holdout contexts are not sufficiently novel relative to training');
assert.ok(b296.learningUpdates>=20,'B296 learning did not persist through holdout horizon');
assert.ok(b296.synapticUpdates>2500,'B296 synaptic updates too low for B303 horizon');
assert.ok(b299.learningUpdates>=20,'B299 learning did not persist through holdout horizon');
assert.ok(b302.verifiedUpdates>=5,'B302 causal evidence did not observe holdout transitions');

const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await restored.init();
await restored.beginBatch();
restored.b303HoldoutSetPhase('recovery','post-restart holdout recovery');
for(let i=80;i<88;i++){
  const r=await restored.autonomousHeartbeat();
  const action=r.decision?.selected?.action ?? 'wait';
  const reward=action==='verify'?.70:action==='explore'?.73:action==='reflect'?.65:action==='rest'?.69:action==='respond'?.53:.40;
  await restored.feedback({success:reward,reward,surprise:i%3===0?.34:.19,evidenceSource:i%4===0?'external':'unknown'});
}
const recovered=restored.b303HoldoutDiagnostics();
await restored.endBatch();
assert.equal(recovered.trainingPulses,beforeRestart.trainingPulses,'B303 training state lost on restart');
assert.equal(recovered.holdoutPulses,beforeRestart.holdoutPulses,'B303 holdout state lost on restart');
assert.ok(recovered.recoveryPulses>=8,'B303 recovery phase did not execute');
assert.ok(recovered.recoveryStability01>.05,'B303 post-restart stability collapsed');
assert.equal(restored.b299CausalPersonalityDiagnostics().learningUpdates,b299.learningUpdates+8,'B299 did not resume from persisted state');
assert.equal(restored.b296NeuralPersonalityAgencyDiagnostics().learningUpdates,b296.learningUpdates+8,'B296 did not resume from persisted state');

const mean=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
const sorted=[...timings].sort((a,b)=>a-b);
const report={
  pass:true, ticks:88, trainingPulses:beforeRestart.trainingPulses, holdoutPulses:beforeRestart.holdoutPulses, recoveryPulses:recovered.recoveryPulses,
  verifiedHoldoutUpdates:beforeRestart.verifiedHoldoutUpdates, autonomousHoldoutUpdates:beforeRestart.autonomousHoldoutUpdates, full, micro,
  meanCycleMs:mean(timings), p95CycleMs:sorted[Math.floor(sorted.length*.95)],
  b303:{
    holdoutCoherence01:beforeRestart.holdoutCoherence01, holdoutPolicyShift01:beforeRestart.holdoutPolicyShift01,
    holdoutDistributionGap01:beforeRestart.holdoutDistributionGap01, unseenTransferScore01:beforeRestart.unseenTransferScore01,
    evaluationReadiness01:beforeRestart.evaluationReadiness01, holdoutNovelContextRate01:beforeRestart.holdoutNovelContextRate01,
    recoveryStability01:recovered.recoveryStability01, trainingContextFingerprints:beforeRestart.trainingContextFingerprints.length,
    holdoutContextFingerprints:beforeRestart.holdoutContextFingerprints.length, contextFingerprints:beforeRestart.contextFingerprints.length
  },
  b296:{learningUpdates:b296.learningUpdates,synapticUpdates:b296.synapticUpdates},
  b299:{learningUpdates:b299.learningUpdates,personalityInfluence01:b299.personalityInfluence01},
  b302:{verifiedUpdates:b302.verifiedUpdates,consolidationWindows:b302.consolidationWindows}
};
console.log(JSON.stringify(report,null,2));
process.exit(0);
