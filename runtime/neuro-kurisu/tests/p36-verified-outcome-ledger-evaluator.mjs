import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import {
  P36AutonomousSelfDevelopmentEngine,
  P36_EXTERNAL_EVIDENCE_TOOL_ID,
  developmentEvidenceVerificationInput,
} from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  hasAuthenticatedOutcomeEvidence,
  ingestSignedOutcomeArtifact,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import {
  createP36VerifiedOutcomeLedgerEvaluator,
  measureP36VerifiedOutcomeLedger,
} from '../src/organism/learning/P36VerifiedOutcomeLedgerEvaluator.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type:'spki', format:'pem' }).toString();
const privatePem = privateKey.export({ type:'pkcs8', format:'pem' }).toString();
const verifierId = 'p36-hosted-signed-holdout-verifier';
const manifest = Array.from({length:4},(_,index)=>({
  taskId:`p36-memory-holdout-${index}`,
  family:'memory',
  split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt(`unique P36 signed holdout task prompt ${index}`),
  verifierId,
  version:'v1',
}));
const ledger = new VerifiedOutcomeLedger(manifest);
let acceptedArtifacts=0;
for(let seed=0;seed<4;seed++){
  for(let taskIndex=0;taskIndex<manifest.length;taskIndex++){
    const task=manifest[taskIndex];
    for(const method of ['baseline-v1','candidate-v1']){
      const passed=method==='candidate-v1'||taskIndex<2;
      const payload={
        schemaVersion:1,
        artifactId:`p36-artifact-${method}-seed-${seed}-task-${task.taskId}`,
        runId:`p36-run-seed-${seed}`,
        manifestFingerprint:ledger.manifestFingerprint(),
        taskId:task.taskId,
        taskVersion:task.version,
        method,
        seed,
        attempt:1,
        passed,
        verifierId,
        observedAt:Date.now(),
      };
      const artifact=signOutcomePayloadForFixture(payload,privatePem);
      const ingested=ingestSignedOutcomeArtifact(ledger,manifest,artifact,new Map([[verifierId,publicPem]]));
      assert.equal(ingested.accepted,true,`signed outcome must be accepted: ${method}/${seed}/${task.taskId}`);
      assert.equal(hasAuthenticatedOutcomeEvidence(ledger,`signed-artifact:${payload.artifactId}:sha256:${ingested.artifactFingerprint}`),true);
      acceptedArtifacts++;
    }
  }
}
assert.equal(acceptedArtifacts,32);
assert.equal(ledger.snapshot().acceptedOutcomes,32);

const manifestFingerprint=ledger.manifestFingerprint();
const config={
  ledger,
  manifest,
  evaluatorVersion:'p36-signed-ledger-v1',
  baselineMethod:'baseline-v1',
  treatmentMethod:'candidate-v1',
  taskFamily:'memory',
  sourceId:'p36-signed-ledger-source',
  independenceKey:'p36-independent-verifier-key',
  minimumPairedSeeds:4,
};
const unscoredQuery={
  hypothesisId:'p36-signed-ledger-hypothesis',
  contextKey:'memory',
  holdout:true,
  delayMs:0,
  evaluatorVersion:config.evaluatorVersion,
  evidenceSource:'external-evaluator',
  protocolId:manifestFingerprint,
  baselineMethod:'baseline-v1',
  treatmentMethod:'candidate-v1',
  taskFamily:'memory',
  manifestFingerprint,
};
const measurement=measureP36VerifiedOutcomeLedger(unscoredQuery,config);
assert.ok(measurement,'the signed, matched holdout ledger should produce a measurement');
assert.equal(measurement.pairedSeedCount,4);
assert.equal(measurement.control01,.5,'task-balanced baseline is half-correct in each independent seed');
assert.equal(measurement.treatment01,1,'task-balanced treatment is fully correct in each independent seed');
assert.equal(measurement.evidenceRefs.length,32);
assert.notEqual(measurement.observationId,'');
assert.equal(measureP36VerifiedOutcomeLedger({...unscoredQuery,delayMs:6000},config),null,
  'point-in-time ledger evidence must not pretend to prove delayed retention');
assert.equal(measureP36VerifiedOutcomeLedger({...unscoredQuery,manifestFingerprint:'0'.repeat(64)},config),null,
  'evidence must be bound to the exact canonical manifest fingerprint');
assert.equal(measureP36VerifiedOutcomeLedger({...unscoredQuery,taskFamily:'relationship',contextKey:'relationship'},config),null,
  'a task family with no signed holdout coverage cannot be measured');
assert.equal(measureP36VerifiedOutcomeLedger({...unscoredQuery,treatmentMethod:'other-candidate'},config),null,
  'the caller cannot select a different treatment method after the host evaluator was configured');

// The hypothesis identity is part of the verifier-bound tuple. Create the
// organism hypothesis first; never verify a placeholder ID and later relabel the receipt.
const p36=new P36AutonomousSelfDevelopmentEngine();
const state={
  version:39,tick:12,at:Date.now(),
  needs:{energy:.72,cognitiveLoad:.3,uncertainty:.75,socialNeed:.2,novelty:.55,identityCoherence:.82,goalPressure:.4},
  predictionError:.62,attentionBudget:.82,lastAction:'reflect',lastActionSuccess:.55,
  autonomyScore:.7,selfPredictionError:.58,predictedNextAction:'reflect',lastPredictionConfidence:.5,worldContextVersion:1,
};
p36.beginCycle();
const hypothesis=p36.propose(state,{worldError01:.7,selfError01:.6,perception01:.4,resourceRisk01:.2});
assert.ok(hypothesis);
assert.notEqual(hypothesis.id,unscoredQuery.hypothesisId,'the test must bind evidence to the actual organism hypothesis');
const hypothesisQuery={...unscoredQuery,hypothesisId:hypothesis.id};
const hypothesisMeasurement=measureP36VerifiedOutcomeLedger(hypothesisQuery,config);
assert.ok(hypothesisMeasurement,'the host evaluator must score the exact hypothesis-bound query');
const evidenceInput=developmentEvidenceVerificationInput({
  ...hypothesisQuery,
  control01:hypothesisMeasurement.control01,
  treatment01:hypothesisMeasurement.treatment01,
});
assert.equal(evidenceInput.manifestFingerprint,manifestFingerprint);
const evaluator=createP36VerifiedOutcomeLedgerEvaluator(config);
const gateway=new ActionGateway({live:true});
gateway.registerTool({id:P36_EXTERNAL_EVIDENCE_TOOL_ID,...evaluator});
const decisionId='p36-ledger-decision-verified';
const result=await gateway.executeTool(
  P36_EXTERNAL_EVIDENCE_TOOL_ID,
  evidenceInput,
  'p36-verified-outcome-ledger-holdout',
  {decisionId},
);
assert.equal(result.ok,true);
assert.equal(result.verified,true);
assert.equal(result.outcomeClass,'executed-verified');
assert.equal(result.verification.basis,'external-postcondition');
assert.equal(result.verification.observationId,measurement.observationId);
assert.match(result.verification.expectedPostcondition,/verified-holdout-ledger:/);

// A caller cannot overwrite the paired ledger scores. A false claim is rejected,
// even though all signed evidence needed for the real result is still available.
const falseClaim={
  ...evidenceInput,
  contextKey:'memory',
  control01:.125,
  treatment01:.875,
};
const rejected=await gateway.executeTool(
  P36_EXTERNAL_EVIDENCE_TOOL_ID,
  falseClaim,
  'p36-forged-score-claim',
  {decisionId:'p36-ledger-decision-forged-claim'},
);
assert.equal(rejected.ok,false);
assert.equal(rejected.verified,false);
assert.equal(rejected.result.error,'p36-verified-ledger-score-claim-mismatch');

// A process-restored ledger is data, not authentication. The adapter fails closed
// until the exact original signed artifacts have been re-ingested and re-authenticated.
const restored=VerifiedOutcomeLedger.restoreSnapshot(ledger.snapshot());
assert.equal(restored.snapshot().acceptedOutcomes,ledger.snapshot().acceptedOutcomes);
for(const row of restored.snapshot().outcomes.slice(0,3)){
  assert.equal(hasAuthenticatedOutcomeEvidence(restored,row.evidenceRef),false);
}
const restoredConfig={...config,ledger:restored};
assert.equal(measureP36VerifiedOutcomeLedger(evidenceInput,restoredConfig),null,
  'plain persisted rows must not pass the signed-evidence gate without re-ingestion');

const recorded=p36.recordExternalEvidence({
  ...evidenceInput,
  // Bind external evidence to the hypothesis actually issued by this engine cycle.
  hypothesisId:hypothesis.id,
  toolId:P36_EXTERNAL_EVIDENCE_TOOL_ID,
  executionId:result.executionId,
  decisionId,
  verification:result.verification,
});
assert.equal(recorded.independentCount,1);
assert.equal(recorded.status,'insufficient');
assert.equal(recorded.promoted,false,'a signed instantaneous holdout does not prove delayed retention or authorize promotion');
assert.equal(p36.snapshot().externalEvidence[0].independentVerified,true);
assert.equal(p36.snapshot().externalEvidence[0].baselineMethod,'baseline-v1');
assert.equal(p36.snapshot().externalEvidence[0].treatmentMethod,'candidate-v1');
assert.equal(p36.snapshot().externalEvidence[0].manifestFingerprint,manifestFingerprint);
assert.equal(p36.snapshot().externalEvidence[0].delayMs,0,
  'the verified ledger adapter never fabricates a positive delay');

console.log('P36_VERIFIED_OUTCOME_LEDGER_EVALUATOR=PASS signed-artifacts=32 paired-seeds=4 score-claims=recomputed restored-ledger=fail-closed delayed-retention=not-claimed');
