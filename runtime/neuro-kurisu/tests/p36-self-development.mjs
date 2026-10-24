import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine, developmentEvidenceVerificationInput, developmentalOutcomeVerificationInput } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const engine=new P36AutonomousSelfDevelopmentEngine();
const state={version:39,tick:12,at:Date.now(),needs:{energy:.72,cognitiveLoad:.3,uncertainty:.75,socialNeed:.2,novelty:.55,identityCoherence:.82,goalPressure:.4},predictionError:.62,attentionBudget:.82,lastAction:'reflect',lastActionSuccess:.55,autonomyScore:.7,selfPredictionError:.58,predictedNextAction:'reflect',lastPredictionConfidence:.5,worldContextVersion:1};
engine.beginCycle();
const h=engine.propose(state,{worldError01:.7,selfError01:.6,perception01:.4,resourceRisk01:.2});
assert.ok(h,'a developmental hypothesis should be generated');
assert.ok(h.hypothesis.length>20);
const previewMetricsBefore={...engine.snapshot().metrics};
const x=engine.runSafeExperiment(h.id,state,7);
assert.ok(x,'safe developmental experiment should run');
assert.equal(x.safeSandbox,true);
assert.deepEqual(engine.snapshot().metrics,previewMetricsBefore,'sandbox previews must not fabricate changes in outcome-derived metrics');
assert.ok(Number.isFinite(engine.snapshot().actionBias.reflect));
const d=engine.diagnostics();
assert.ok(d.cycles===1);
assert.ok(d.experiments===1);
assert.ok(d.curriculum.completedSteps>=0);

assert.equal(d.acceptedChanges,0,'safe sandbox previews must not count as accepted organism changes');

const verifier=new OutcomeVerificationService();
let receiptSequence=0;
async function mintProof(binding, suppliedObservationId){
  const observationId=suppliedObservationId??('p36-independent-proof-'+(++receiptSequence));
  return verifier.verify({
    toolId:'p36-independent-fixture-verifier',
    input:binding,
    result:{fixture:'independent-evaluator',observationId},
  },()=>({
    verified:true,
    basis:'external-postcondition',
    externalObservation:true,
    confidence01:1,
    observationId,
    expectedPostcondition:'evaluation-completed:'+observationId,
    observedPostcondition:'evaluation-completed:'+observationId,
  }));
}
function prepareHypothesis(engine,tick){
  engine.beginCycle();
  const hypothesis=engine.propose({...state,tick},{worldError01:.7,selfError01:.6,perception01:.4,resourceRisk01:.2});
  assert.ok(hypothesis,'test fixture should produce a development hypothesis');
  return hypothesis;
}
function evidence(hypothesisId,contextKey,holdout,delayMs,source='external-evaluator'){
  return {hypothesisId,contextKey,control01:.4,treatment01:.6,holdout,delayMs,evaluatorVersion:'fixture-eval-v1',evidenceSource:source};
}

// Caller booleans, copied receipts, and manual observations cannot authorize learning.
const guardEngine=new P36AutonomousSelfDevelopmentEngine();
const guardHypothesis=prepareHypothesis(guardEngine,101);
const spoof=evidence(guardHypothesis.id,'spoof-context',true,1000);
const spoofResult=guardEngine.recordExternalEvidence({...spoof,independentVerified:true});
assert.equal(spoofResult.independentCount,0,'independentVerified=true is not proof');
assert.equal(spoofResult.status,'insufficient');
assert.equal(spoofResult.promoted,false);
assert.throws(()=>guardEngine.recordExternalEvidence({...spoof,control01:NaN}),/invalid-development-evidence/,'non-finite evaluator scores must be rejected');
const copyPayload=evidence(guardHypothesis.id,'copy-context',true,1000);
const copyReceipt=await mintProof(developmentEvidenceVerificationInput(copyPayload));
const copiedResult=guardEngine.recordExternalEvidence({...copyPayload,independentVerified:true,verification:structuredClone(copyReceipt)});
assert.equal(copiedResult.independentCount,0,'structured-cloned verifier output must not retain trust');
assert.equal(copiedResult.promoted,false);
const manualPayload=evidence(guardHypothesis.id,'manual-context',true,1000,'manual-observer');
const manualReceipt=await mintProof(developmentEvidenceVerificationInput(manualPayload));
const manualResult=guardEngine.recordExternalEvidence({...manualPayload,verification:manualReceipt});
assert.equal(manualResult.independentCount,0,'manual observer evidence cannot enter the independent-evaluator lane');
assert.equal(guardEngine.diagnostics().acceptedChanges,0);

// A forged row must not occupy the duplicate key and block its later valid receipt.
const campaign=new P36AutonomousSelfDevelopmentEngine();
const campaignHypothesis=prepareHypothesis(campaign,102);
const first=evidence(campaignHypothesis.id,'context-a',false,0);
const poisoned=campaign.recordExternalEvidence({...first,independentVerified:true});
assert.equal(poisoned.independentCount,0);
const firstProof=await mintProof(developmentEvidenceVerificationInput(first));
const repaired=campaign.recordExternalEvidence({...first,independentVerified:false,verification:firstProof});
assert.equal(repaired.independentCount,1,'a verified receipt replaces an untrusted row with the same identity');
assert.equal(campaign.snapshot().externalEvidence.find(row=>row.contextKey==='context-a').independentVerified,true);
const repeated=campaign.recordExternalEvidence({...first,verification:firstProof});
assert.equal(repeated.independentCount,1,'re-delivery of the same evidence identity is idempotent');

const followups=[
  {contextKey:'context-b',holdout:false,delayMs:1000},
  {contextKey:'holdout-c',holdout:true,delayMs:1000},
  {contextKey:'holdout-d',holdout:true,delayMs:6000},
  {contextKey:'holdout-e',holdout:true,delayMs:36000},
  {contextKey:'holdout-f',holdout:true,delayMs:216000},
];
let heldoutResult=repaired;
for(const item of followups){
  const payload=evidence(campaignHypothesis.id,item.contextKey,item.holdout,item.delayMs);
  const proof=await mintProof(developmentEvidenceVerificationInput(payload));
  heldoutResult=campaign.recordExternalEvidence({...payload,verification:proof});
  if(item.contextKey==='holdout-d'){
    assert.equal(heldoutResult.status,'holdout-verified','paired independent holdout should unlock the intermediate gate');
    assert.equal(heldoutResult.promoted,false,'holdout verification is provisional until independent replication');
    assert.equal(campaign.diagnostics().acceptedChanges,0,'holdout alone must not mutate learned weights');
    assert.notEqual(campaign.snapshot().hypotheses.find(row=>row.id===campaignHypothesis.id).status,'completed');
  }
}
assert.equal(heldoutResult.status,'replicated','promotion requires independent, delayed multi-context replication');
assert.equal(heldoutResult.promoted,true);
assert.equal(heldoutResult.independentCount,6);
assert.equal(campaign.snapshot().hypotheses.find(row=>row.id===campaignHypothesis.id).evidenceGate,'replicated');
assert.equal(campaign.snapshot().hypotheses.find(row=>row.id===campaignHypothesis.id).status,'completed');
assert.equal(campaign.diagnostics().acceptedChanges,1,'only replicated evidence increments accepted changes');

// A valid observation ID cannot be reused to manufacture another independent context.
const reuseEngine=new P36AutonomousSelfDevelopmentEngine();
const reuseHypothesis=prepareHypothesis(reuseEngine,103);
const reuseId='p36-one-observation-used-twice';
const reuseA=evidence(reuseHypothesis.id,'reuse-a',false,0);
const reuseProofA=await mintProof(developmentEvidenceVerificationInput(reuseA),reuseId);
const acceptedA=reuseEngine.recordExternalEvidence({...reuseA,verification:reuseProofA});
assert.equal(acceptedA.independentCount,1);
const reuseB=evidence(reuseHypothesis.id,'reuse-b',true,6000);
const reuseProofB=await mintProof(developmentEvidenceVerificationInput(reuseB),reuseId);
const blockedReuse=reuseEngine.recordExternalEvidence({...reuseB,verification:reuseProofB});
assert.equal(blockedReuse.independentCount,1,'reused observation IDs cannot inflate replication across contexts');

// One verified observation cannot be credited once as experiment evidence and again as a maturity outcome.
const crossPathEngine=new P36AutonomousSelfDevelopmentEngine();
const crossPathHypothesis=prepareHypothesis(crossPathEngine,104);
const crossPathId='p36-cross-path-receipt';
const crossPathEvidence=evidence(crossPathHypothesis.id,'cross-path-experiment',false,0);
const crossPathProof=await mintProof(developmentEvidenceVerificationInput(crossPathEvidence),crossPathId);
assert.equal(crossPathEngine.recordExternalEvidence({...crossPathEvidence,verification:crossPathProof}).independentCount,1);
const crossPathOutcome={area:'learning',outcome01:.9,delayed:true,transfer:true};
const crossPathOutcomeProof=await mintProof(developmentalOutcomeVerificationInput(crossPathOutcome),crossPathId);
const crossPathMaturity=crossPathEngine.observeDevelopmentalOutcome({...crossPathOutcome,verification:crossPathOutcomeProof});
assert.equal(crossPathMaturity.verifiedOutcomeCount,0,'same observation cannot be credited through a second learning route');

// Maturity counts also require verifier provenance, and the same receipt can count only once.
const maturityEngine=new P36AutonomousSelfDevelopmentEngine();
const outcome={area:'learning',outcome01:.95,delayed:true,transfer:true};
const forgedMaturity=maturityEngine.observeDevelopmentalOutcome({...outcome,verified:true});
assert.equal(forgedMaturity.verifiedOutcomeCount,0,'a caller boolean cannot certify developmental maturity');
assert.throws(()=>maturityEngine.observeDevelopmentalOutcome({...outcome,outcome01:1.1}),/invalid-developmental-outcome/,'out-of-range outcomes must be rejected');
const outcomeProof=await mintProof(developmentalOutcomeVerificationInput(outcome));
const measuredMaturity=maturityEngine.observeDevelopmentalOutcome({...outcome,verified:false,verification:outcomeProof});
assert.equal(measuredMaturity.verifiedOutcomeCount,1);
assert.equal(measuredMaturity.retainedOutcomeCount,1);
assert.equal(measuredMaturity.transferredOutcomeCount,1);
const duplicatedMaturity=maturityEngine.observeDevelopmentalOutcome({...outcome,verification:outcomeProof});
assert.equal(duplicatedMaturity.verifiedOutcomeCount,1,'the same authenticated outcome receipt is idempotent');
const copiedMaturity=maturityEngine.observeDevelopmentalOutcome({...outcome,verification:structuredClone(outcomeProof)});
assert.equal(copiedMaturity.verifiedOutcomeCount,1,'a serialized copy cannot replay a trusted maturity receipt');
const reusedMaturityProof=await mintProof(developmentalOutcomeVerificationInput({...outcome,area:'memory',outcome01:.8}),outcomeProof.observationId);
const reusedMaturity=maturityEngine.observeDevelopmentalOutcome({area:'memory',outcome01:.8,delayed:true,transfer:true,verification:reusedMaturityProof});
assert.equal(reusedMaturity.verifiedOutcomeCount,1,'one observation ID cannot certify two different developmental outcomes');

// A restored snapshot is informative history, not authenticated proof of independent learning.
const forgedSnapshot=campaign.snapshot();
forgedSnapshot.externalEvidence=forgedSnapshot.externalEvidence.map(row=>({...row,independentVerified:true,observationId:'forged-persisted-proof'}));
forgedSnapshot.developmentalMaturity={stage:'stable',score01:1,verifiedOutcomeCount:12,retainedOutcomeCount:8,transferredOutcomeCount:6,regressionCount:0,lastTransitionAt:Date.now(),history:[]};
const restored=new P36AutonomousSelfDevelopmentEngine();
restored.restore(forgedSnapshot);
assert.equal(restored.snapshot().externalEvidence.some(row=>row.independentVerified),false,'serialized evidence booleans must be demoted at restore');
assert.equal(restored.developmentalCertification().certified,false,'persisted aggregate counters cannot self-certify maturity');
assert.equal(restored.snapshot().developmentalMaturity.verifiedOutcomeCount,0);
assert.equal(restored.snapshot().developmentalEvidenceReceiptIds.length,0);
assert.equal(restored.snapshot().developmentalEvidenceObservationIds.length,6,'deduplication identities survive restore without restoring trust');
assert.equal(restored.snapshot().acceptedChanges,0,'persisted accepted-change counters cannot outlive authenticated provenance');
assert.equal(restored.snapshot().hypotheses.find(row=>row.id===campaignHypothesis.id).status,'awaiting-evidence','previously promoted hypotheses must return to evidence review after trust is revoked');
assert.equal(restored.snapshot().hypotheses.find(row=>row.id===campaignHypothesis.id).evidenceGate,'none');
assert.equal(restored.snapshot().curriculum.completedSteps,0);
assert.deepEqual(restored.snapshot().actionBias,{respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},'policy effects are reset when promotion proof cannot be re-authenticated');
console.log('P36_SELF_DEVELOPMENT_PROVENANCE=PASS spoofed-flags=blocked copied-receipts=blocked manual-lane=blocked duplicate-poisoning=blocked reused-observation=blocked holdout=verified replication=verified maturity-idempotency=verified restore-demotion=verified');
console.log('P36_SELF_DEVELOPMENT=PASS',JSON.stringify({area:h.area,delta01:x.delta01,acceptedChanges:d.acceptedChanges,focus:d.curriculum.focus}));

