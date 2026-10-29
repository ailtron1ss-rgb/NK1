import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const f=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
const base={id:'m103',kind:'episodic',source:'runtime',content:'causal memory replay transfer test',createdAt:1,lastAccessAt:1,retrievalCount:0,salience:.84,identityRelevance:.72,goalRelevance:.82,predictionError:.78,emotionalWeight:.42,socialRelevance:.36,confidence:.82,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.74,activeGoalIds:['goal-A'],evidenceSupport01:.82});
const candidates=f.replayCandidates(4,['goal-A']); assert.equal(candidates.length,1); assert.ok(candidates[0].replayPriority01>.5);
const r=f.reactivate('m103',1000); assert.ok(r); assert.equal(r.tier,'hot');
const before=f.snapshot().graphNodes[0].stability01;
const untrustedValidation=f.recordReplayValidation({
  memoryId:'m103',taskId:'task-X',contextKey:'x1',delayMs:100,baselineScore01:.5,
  retentionScore01:.92,transferPotential01:.71,interferenceRisk01:.04,
  independentVerified:true,evidenceKey:'holdout:untrusted:m103:1',at:1050
});
assert.equal(untrustedValidation.independentVerified,false,'a caller boolean must not manufacture independent replay evidence');
assert.equal(f.snapshot().replay.validated,0,'untrusted replay receipts must not move validated replay metrics');

const verificationInput={
  memoryId:'m103',evidenceKey:'holdout:m103:1',taskId:'task-X',contextKey:'x1',
  delayMs:100,retentionScore01:.92,baselineScore01:.5,transferPotential01:.71,interferenceRisk01:.04
};
const verificationService=new OutcomeVerificationService();
const verification=await verificationService.verify({
  toolId:'memory.retention-postcondition',
  input:verificationInput,
  result:{retentionScore01:.92}
},()=>({
  verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
  observationId:'obs-m103-retention-1',
  expectedPostcondition:'retention-score:0.92',
  observedPostcondition:'retention-score:0.92'
}));
assert.equal(verification.verified,true,'the test verifier must mint a trusted, matching external postcondition');
const validation=f.recordReplayValidation({...verificationInput,verification,at:1100});
assert.equal(validation.independentVerified,true,'only the exact service-minted receipt may authorize retention learning');
assert.ok(f.snapshot().replay.validated===1);
assert.ok(f.snapshot().graphNodes[0].stability01>=before);
const recordReplayWithReceipt=async(input)=>{
  const verificationInput={
    experimentId:'exp103',taskId:'task-X',mode:input.mode,
    preScore01:input.preScore01,postScore01:input.postScore01,
    randomized:true,contextKey:input.contextKey,pairKey:input.pairKey,at:input.at
  };
  const postcondition=`replay-score:${input.experimentId}:${input.mode}:${input.pairKey}:${input.postScore01}`;
  const verification=await verificationService.verify({
    toolId:'memory.replay-experiment-postcondition',
    input:verificationInput,
    result:{postScore01:input.postScore01}
  },()=>({
    verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
    observationId:`obs-${input.experimentId}-${input.mode}-${input.pairKey}`,
    expectedPostcondition:postcondition,observedPostcondition:postcondition
  }));
  return f.recordReplayExperimentTrial({...input,independentVerified:true,verification});
};
await recordReplayWithReceipt({experimentId:'exp103',taskId:'task-X',mode:'replay-on',preScore01:.5,postScore01:.8,randomized:true,contextKey:'x1',pairKey:'pair-1',at:1200});
await recordReplayWithReceipt({experimentId:'exp103',taskId:'task-X',mode:'replay-on',preScore01:.5,postScore01:.74,randomized:true,contextKey:'x2',pairKey:'pair-2',at:1300});
await recordReplayWithReceipt({experimentId:'exp103',taskId:'task-X',mode:'replay-off',preScore01:.5,postScore01:.56,randomized:true,contextKey:'x1',pairKey:'pair-1',at:1400});
await recordReplayWithReceipt({experimentId:'exp103',taskId:'task-X',mode:'replay-off',preScore01:.5,postScore01:.59,randomized:true,contextKey:'x2',pairKey:'pair-2',at:1500});
const exp=f.replayExperimentSummary('exp103','task-X');
assert.equal(exp.pairedComparable,true); assert.equal(exp.evidenceGrade,'randomized-matched-observational'); assert.ok((exp.estimatedConditionDifference01??0)>.1);

const cx=new CausalExperienceStream();
const replayRecord=cx.recordExternalLearningEvent({tick:8,taskId:'replay:m103',action:'reflect',reward01:.5,success01:.5,surprise01:.7,novelty01:.6,causalStrength01:.67,provenance:'experience-replay',stateGrounded:false,sourceMemoryId:'m103',evidenceKey:'replay:m103'});
const repairRecord=cx.recordExternalLearningEvent({tick:9,taskId:'repair:demo',action:'explore',reward01:.9,success01:1,surprise01:.4,novelty01:.5,causalStrength01:.75,provenance:'skill-repair',stateGrounded:false,evidenceKey:'repair:demo'});
assert.equal(replayRecord.provenance,'external','caller-provided replay provenance must be downgraded without trusted runtime evidence'); assert.equal(replayRecord.stateGrounded,false); assert.equal(repairRecord.provenance,'external','caller-provided skill-repair provenance must also be downgraded');

const ul=new UnifiedLearningSubstrate();
const replaySignal=ul.ingestExternalSignal({taskId:'replay:m103',action:'reflect',reward01:.5,success01:.5,surprise01:.7,novelty01:.6,causalStrength01:.67,transferPotential01:.65,provenance:'experience-replay'});
assert.ok(replaySignal.learningOpportunity01>.4);
const probe=ul.beginTransferProbe({sourceTaskId:'source-X',targetTaskId:'target-Y',baseline01:.48,contextKey:'holdout-1',at:1600});
assert.ok(probe);
const claimOnly=new UnifiedLearningSubstrate();
const claimedProbe=claimOnly.recordTransferProbe({...probe,id:probe.id+'-claimed-only',postScore01:.66,independentVerified:true,holdout:true});
assert.ok(claimedProbe);
assert.equal(claimedProbe.independentVerified,false,'caller booleans cannot mint transfer verification');
assert.equal(claimOnly.transferDiagnostics().validatedSamples,0,'caller booleans must not produce a validated transfer sample');

const mintTransferReceipt=async(candidate,postScore01)=>{
  const verificationInput={id:candidate.id,sourceTaskId:candidate.sourceTaskId,targetTaskId:candidate.targetTaskId,
    baseline01:candidate.baseline01,postScore01,holdout:true,contextKey:candidate.contextKey,at:candidate.at};
  const postcondition=`transfer-score:${candidate.id}:${postScore01}`;
  return verificationService.verify({toolId:'learning.transfer-probe-postcondition',input:verificationInput,result:{postScore01}},()=>({
    verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
    observationId:`obs-transfer-${candidate.id}`,expectedPostcondition:postcondition,observedPostcondition:postcondition,
  }));
};
const firstCandidate={...probe,postScore01:.66,independentVerified:true,holdout:true};
const transferInput={...firstCandidate,verification:await mintTransferReceipt(firstCandidate,.66)};
const firstTransfer=ul.recordTransferProbe(transferInput);
assert.ok(firstTransfer);
assert.equal(firstTransfer.independentVerified,true);
assert.equal(firstTransfer.holdout,true);
assert.deepEqual(ul.recordTransferProbe(transferInput),firstTransfer,'repeated receipt-bound evidence ID with identical payload must be idempotent');
assert.equal(ul.transferDiagnostics().validatedSamples,1,'an exact retry must not mint a second validated transfer sample');
assert.equal(ul.recordTransferProbe({...transferInput,postScore01:.91}),null,'reusing an evidence ID with a conflicting outcome must be rejected');
assert.equal(ul.recordTransferProbe({...transferInput,id:'bad-nan-transfer',postScore01:Number.NaN}),null,'non-finite scores must not be clamped into valid transfer evidence');
assert.equal(ul.recordTransferProbe({...transferInput,id:'bad-control-transfer\n',postScore01:.66}),null,'control-bearing IDs must not enter the evidence ledger');
const secondCandidate={...probe,id:probe.id+'-2',postScore01:.64,independentVerified:true,holdout:true};
const secondTransfer=ul.recordTransferProbe({...secondCandidate,verification:await mintTransferReceipt(secondCandidate,.64)});
assert.ok(secondTransfer);
const td=ul.transferDiagnostics();
assert.equal(td.validatedSamples,2); assert.equal(td.positiveSamples,2); assert.equal(td.negativeSamples,0); assert.ok(td.crossTaskTransfer01>0);
const diag=ul.diagnostics();
assert.equal(diag.version,2);
assert.equal(diag.provenanceCounts.experienceReplay,0,'caller-provided replay provenance must not be counted as trusted replay evidence');
assert.equal(diag.provenanceCounts.external,1,'unverified replay claims must remain in the external-hypothesis lane');
assert.equal(ul.pendingExternalHypotheses()[0]?.claimedProvenance,'experience-replay','the claimed origin may be retained for review without granting trusted provenance');

// Recent transfer rows are bounded, but stable evidence IDs remain reserved after eviction.
for(let i=0;i<105;i++){
  assert.ok(ul.recordTransferProbe({id:'ledger-fill-'+i,sourceTaskId:'fill-source',targetTaskId:'fill-target',
    baseline01:.4,postScore01:.41,independentVerified:false,holdout:false,contextKey:'fill-context-'+i,at:2000+i}));
}
assert.ok(!ul.snapshot().transferProbes.some(row=>row.id===probe.id),'the original probe must leave the 96-row recent window');
const ledgerCredit=ul.transferDiagnostics().validatedSamples;
assert.equal(ul.recordTransferProbe(transferInput),null,'an evicted but remembered ID must not re-enter the transfer evidence window');
assert.equal(ul.transferDiagnostics().validatedSamples,ledgerCredit,'an evicted retry must not increment transfer credit');
const ulRestored=new UnifiedLearningSubstrate(); ulRestored.restore(ul.snapshot());
assert.equal(ulRestored.transferDiagnostics().validatedSamples,0,'serialized booleans cannot carry verifier authority across process restore');
assert.ok(ulRestored.snapshot().transferProbes.every(row=>row.independentVerified===false&&row.holdout===false),
  'restored transfer rows remain available as history but are not credited without a durable verifier receipt');
assert.equal(ulRestored.recordTransferProbe(transferInput),null,'the transfer ID registry must survive snapshot restoration');
assert.ok(ulRestored.snapshot().transferProbeLedger.length<=4096,'the transfer evidence registry must remain bounded');
const poisonedSnapshot=ul.snapshot();
poisonedSnapshot.transferProbes=[{id:'poisoned-restored',sourceTaskId:'x',targetTaskId:'y',baseline01:.2,postScore01:.9,delta01:.01,independentVerified:true,holdout:true,contextKey:'restored-context',at:9}];
const poisonedRestore=new UnifiedLearningSubstrate(); poisonedRestore.restore(poisonedSnapshot);
assert.equal(poisonedRestore.snapshot().transferProbes.some(row=>row.id==='poisoned-restored'),false,'restored probe rows with inconsistent deltas must be rejected');

console.log('BIG_PASS_103_MEMORY_TRANSFER=PASS',JSON.stringify({
  replayValidated:f.snapshot().replay.validated,
  experimentDifference:Number((exp.estimatedConditionDifference01??0).toFixed(3)),
  causalProvenance:replayRecord.provenance,
  transferValidated:td.validatedSamples,
  positiveTransfer:td.positiveSamples,
  interference:Number(td.interference01.toFixed(3)),
  unifiedVersion:diag.version
}));
