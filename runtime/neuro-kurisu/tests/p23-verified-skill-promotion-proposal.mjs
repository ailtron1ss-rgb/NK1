import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { isAuthenticVerifiedSkillPromotionProposal, proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { evaluateSkillRevision } from '../src/organism/learning/SkillRevisionGate.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeys = new Map([['verifier-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const manifest = Array.from({length:10},(_,i)=>({
  taskId:'task-'+i, family:i<5?'memory':'tool-use', split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('unique prompt '+i),
  verifierId:'verifier-v1', version:'v1',
}));

function recordSigned(ledger, taskId, method, seed, passed, attempt=1) {
  const task = manifest.find(entry => entry.taskId === taskId);
  const payload = {
    schemaVersion: 1, artifactId: `artifact-${taskId}-${method}-${seed}-${attempt}`,
    runId: `run-${method}-${seed}`, manifestFingerprint: ledger.manifestFingerprint(),
    taskId, taskVersion: task.version, method, seed, attempt, passed,
    verifierId: task.verifierId, observedAt: Date.now(),
  };
  const artifact = signOutcomePayloadForFixture(payload, privateKeyPem);
  return ingestSignedOutcomeArtifact(ledger, manifest, artifact, trustedKeys);
}

const ledger = new VerifiedOutcomeLedger(manifest);
for (let seed=1;seed<=5;seed++) for (let i=0;i<10;i++) {
  for (const [method,passed] of [['baseline',i<6],['candidate',i<8]]) {
    const result=recordSigned(ledger,'task-'+i,method,seed,passed);
    assert.equal(result.accepted,true);
  }
}
const proposal=proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3});
assert.equal(proposal.gate.accepted,true);
assert.equal(proposal.gate.pairedN,50, 'pairedN counts task × seed pairs, not unique tasks');
assert.equal(proposal.pairedTaskSeedN,50);
assert.equal(proposal.uniquePairedTasks,10);
assert.equal(proposal.completePairedSeeds,5);
assert.equal(proposal.seedClusteredEvaluation.pairedN,5);
assert.ok(proposal.seedClusteredEvaluation.approximate95CI[0] > 0);
assert.ok(proposal.seedClusteredEvaluation.bootstrap95CI[0] > 0,
  'promotion requires positive lower bounds from both parametric and seed-cluster bootstrap intervals');
assert.equal(proposal.familyEvaluation.length,2);
assert.equal(proposal.canActivateAutomatically,false);

// An aggregate memory/overall gain must not hide a required task family with
// zero improvement. Family floors are explicit per-skill policy, not a hidden
// global ban on specialized skills.
const memoryFloorBlocked = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: .1,
  minCompleteSeeds: 3,
  minimumFamilyGainByFamily: { memory: .01, 'tool-use': .3 },
});
assert.equal(memoryFloorBlocked.gate.accepted, false);
assert.equal(memoryFloorBlocked.gate.reason, 'required-family-gain-below-threshold:memory');
assert.deepEqual(memoryFloorBlocked.evaluationPolicy.minimumFamilyGainByFamily, { memory: .01, 'tool-use': .3 });
assert.deepEqual(memoryFloorBlocked.evaluationPolicy.minimumFamilyTasksByFamily, { memory: 2, 'tool-use': 2 });
assert.equal(memoryFloorBlocked.evaluationPolicy.minCompleteSeeds, 3);
assert.equal(isAuthenticVerifiedSkillPromotionProposal(memoryFloorBlocked), true,
  'the family floor and its failed decision must be covered by the proposal authenticity digest');

const memoryTaskCoverageBlocked = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: .1,
  minCompleteSeeds: 3,
  minimumFamilyGainByFamily: { memory: .01 },
  minimumFamilyTasksByFamily: { memory: 6 },
});
assert.equal(memoryTaskCoverageBlocked.gate.accepted, false);
assert.equal(memoryTaskCoverageBlocked.gate.reason, 'required-family-task-coverage-insufficient:memory');
assert.equal(memoryTaskCoverageBlocked.familyTaskCoverage.memory, 5,
  'paired seed repetitions must not be misreported as additional distinct tasks');
assert.equal(isAuthenticVerifiedSkillPromotionProposal(memoryTaskCoverageBlocked), true);

assert.throws(
  () => proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minimumFamilyGainByFamily: { memory: .01 },
    minimumFamilyTasksByFamily: { memory: 1 },
  }),
  /minimum-family-task-policy-threshold-invalid:memory/,
);
assert.throws(
  () => proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minimumFamilyGainByFamily: { memory: .01 },
    minimumFamilyTasksByFamily: { transfer: 3 },
  }),
  /minimum-family-task-policy-without-family-gain-floor:transfer/,
);

const toolUseFloorMet = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: .1,
  minCompleteSeeds: 3,
  minimumFamilyGainByFamily: { 'tool-use': .3 },
});
assert.equal(toolUseFloorMet.gate.accepted, true, 'the tool-use family exceeds its explicitly required gain');
assert.notEqual(toolUseFloorMet.proposalId, proposal.proposalId,
  'changing promotion thresholds must change the authenticated proposal identity');
assert.notEqual(toolUseFloorMet.proposalId, memoryFloorBlocked.proposalId);
const stricterPolicyStillMet = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: .1,
  minCompleteSeeds: 3,
  minimumFamilyGainByFamily: { 'tool-use': .35 },
});
assert.equal(stricterPolicyStillMet.gate.accepted, true);
assert.notEqual(stricterPolicyStillMet.proposalId, toolUseFloorMet.proposalId,
  'different thresholds must produce different proposal IDs even when both candidates pass');
assert.equal(isAuthenticVerifiedSkillPromotionProposal(stricterPolicyStillMet), true);

const missingFamilyEvidence = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: .1,
  minCompleteSeeds: 3,
  minimumFamilyGainByFamily: { transfer: .01 },
});
assert.equal(missingFamilyEvidence.gate.accepted, false);
assert.equal(missingFamilyEvidence.gate.reason, 'required-family-evidence-insufficient:transfer',
  'required but unmeasured families must fail closed rather than inherit aggregate gains');

assert.throws(
  () => proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minimumFamilyGainByFamily: null,
  }),
  /minimum-family-gain-policy-must-be-a-plain-object/,
);
assert.throws(
  () => proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minimumFamilyGainByFamily: { memory: 1.01 },
  }),
  /minimum-family-gain-policy-threshold-invalid:memory/,
);
assert.equal(proposal.authenticatedEvidenceRows,100);
assert.equal(proposal.unauthenticatedEvidenceRows,0);
assert.match(proposal.proposalId,/^[a-f0-9]{64}$/);
assert.match(proposal.datasetFingerprint,/^[a-f0-9]{64}$/);
assert.ok(proposal.activationRequirements.length>=4);
const repeatedProposal=proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3});
assert.equal(repeatedProposal.datasetFingerprint,proposal.datasetFingerprint,
  'verified dataset identity must be stable for an unchanged ledger');
assert.equal(repeatedProposal.proposalId,proposal.proposalId,
  'proposal identity is stable for an unchanged manifest/outcome ledger');
assert.equal(isAuthenticVerifiedSkillPromotionProposal(proposal), true);
const tamperedProposal = proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3});
const originalDatasetFingerprint = tamperedProposal.datasetFingerprint;
tamperedProposal.datasetFingerprint = 'f'.repeat(64);
assert.equal(isAuthenticVerifiedSkillPromotionProposal(tamperedProposal), false,
  'authenticity must be invalidated when any proposal field changes after issuance');
const originalView = { ...tamperedProposal, datasetFingerprint: originalDatasetFingerprint };
Object.defineProperty(tamperedProposal, 'toJSON', { value: () => originalView, configurable: true });
assert.equal(isAuthenticVerifiedSkillPromotionProposal(tamperedProposal), false,
  'custom JSON serialization must not conceal post-issuance proposal mutation');

// An opaque evidenceRef cannot impersonate a verified signed artifact.
const forgedLedger = new VerifiedOutcomeLedger(manifest);
for (let i=0;i<10;i++) for (const [method,passed] of [['baseline',false],['candidate',true]]) {
  assert.equal(forgedLedger.record({
    taskId:'task-'+i,taskVersion:'v1',method,seed:1,attempt:1,passed,
    authority:'independent-verifier',verifierId:'verifier-v1',
    evidenceRef:`signed-artifact:forged-${i}-${method}:sha256:${'a'.repeat(64)}`,observedAt:Date.now(),
  }).accepted,true);
}
const forgedProposal=proposeVerifiedSkillPromotion(forgedLedger,'baseline','candidate',{minPairedTasks:8});
assert.equal(forgedProposal.gate.accepted,false);
assert.equal(forgedProposal.gate.reason,'unauthenticated-outcome-evidence');
assert.equal(forgedProposal.authenticatedEvidenceRows,0);
assert.equal(forgedProposal.unauthenticatedEvidenceRows,20);

// Non-finite thresholds must not turn minimum paired-task requirements into NaN bypasses.
const tinyObservations = [];
for (let i=0;i<2;i++) for (const [method,passed] of [['baseline',false],['candidate',true]]) {
  tinyObservations.push({taskId:'tiny-'+i,family:'memory',split:'holdout',method,seed:1,attempt:1,passed,
    authority:'independent-verifier',verifierId:'v',expectedVerifierId:'v',evidenceRef:'e-'+i+'-'+method});
}
const nanThreshold = evaluateSkillRevision(tinyObservations,'baseline','candidate',{minPairedTasks:Number.NaN});
assert.equal(nanThreshold.accepted,false);
assert.equal(nanThreshold.reason,'insufficient-independent-heldout-pairs');

const smallGainObservations = [];
for (let i=0;i<100;i++) for (const [method,passed] of [['baseline',false],['candidate',i===0]]) {
  smallGainObservations.push({taskId:'fraction-'+i,family:'general',split:'holdout',method,seed:1,attempt:1,passed,
    authority:'independent-verifier',verifierId:'v',expectedVerifierId:'v',evidenceRef:'fraction-'+i+'-'+method});
}
const nanGainThreshold = evaluateSkillRevision(smallGainObservations,'baseline','candidate',{
  minPairedTasks:8,minAbsoluteGain:Number.NaN,
});
assert.equal(nanGainThreshold.accepted,false);
assert.equal(nanGainThreshold.reason,'no-material-heldout-improvement',
  'NaN must use the conservative 0.02 default, not silently reduce the minimum gain to zero');

// Authenticated but incomplete paired-seed coverage remains blocked for coverage, not provenance.
const incomplete = new VerifiedOutcomeLedger(manifest);
for (let i=0;i<10;i++) assert.equal(recordSigned(incomplete,'task-'+i,'baseline',2,true).accepted,true);
for (let i=0;i<8;i++) assert.equal(recordSigned(incomplete,'task-'+i,'candidate',2,true).accepted,true);
const blocked=proposeVerifiedSkillPromotion(incomplete,'baseline','candidate',{minPairedTasks:8,minCompleteSeeds:3});
assert.equal(blocked.gate.accepted,false);
assert.equal(blocked.gate.reason,'insufficient-complete-holdout-seed-coverage');
assert.equal(blocked.unauthenticatedEvidenceRows,0);

// Repeating seeds on two tasks must not masquerade as broad task coverage.
const narrow = new VerifiedOutcomeLedger(manifest);
for (let seed=0;seed<10;seed++) for (let i=0;i<2;i++) for (const method of ['baseline','candidate']) {
  assert.equal(recordSigned(narrow,'task-'+i,method,seed,method==='candidate').accepted,true);
}
const narrowProposal=proposeVerifiedSkillPromotion(narrow,'baseline','candidate',{minPairedTasks:8,minCompleteSeeds:3});
assert.equal(narrowProposal.gate.accepted,false);
assert.equal(narrowProposal.uniquePairedTasks,2);
assert.equal(narrowProposal.gate.reason,'insufficient-independent-heldout-task-coverage');

// Producer policy must reject malformed runtime configuration rather than clamp it.
const strictPolicyLedger = new VerifiedOutcomeLedger(manifest);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minPairedTasks: Number.NaN }),
  /verified-skill-promotion-min-paired-tasks-must-be-an-integer-from-2-to-10000/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minPairedTasks: 1 }),
  /verified-skill-promotion-min-paired-tasks-must-be-an-integer-from-2-to-10000/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minAbsoluteGain: Number.NaN }),
  /verified-skill-promotion-min-absolute-gain-must-be-finite-and-in-range-0-to-1/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minAbsoluteGain: 1.01 }),
  /verified-skill-promotion-min-absolute-gain-must-be-finite-and-in-range-0-to-1/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { maxFamilyRegression: -0.01 }),
  /verified-skill-promotion-max-family-regression-must-be-finite-and-in-range-0-to-1/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minCompleteSeeds: 2 }),
  /verified-skill-promotion-min-complete-seeds-must-be-an-integer-from-3-to-1000/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', { minCompleteSeeds: Number.NaN }),
  /verified-skill-promotion-min-complete-seeds-must-be-an-integer-from-3-to-1000/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', null),
  /verified-skill-promotion-options-must-be-a-plain-data-object/);
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 42, 'candidate', {}),
  /two distinct method names are required/);
let promotionOptionGetterCalls = 0;
const promotionOptionsWithGetter = {};
Object.defineProperty(promotionOptionsWithGetter, 'minPairedTasks', {
  enumerable: true, configurable: true,
  get() { promotionOptionGetterCalls++; return 8; },
});
assert.throws(() => proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', promotionOptionsWithGetter),
  /verified-skill-promotion-options-must-use-own-data-properties/);
assert.equal(promotionOptionGetterCalls, 0, 'promotion policy snapshot must not invoke caller getters');
let ignoredPromotionOptionGetterCalls = 0;
const promotionOptionsWithIgnoredGetter = {};
Object.defineProperty(promotionOptionsWithIgnoredGetter, 'externalMetadata', {
  enumerable: true, configurable: true,
  get() { ignoredPromotionOptionGetterCalls++; return 'unbound'; },
});
assert.equal(proposeVerifiedSkillPromotion(strictPolicyLedger, 'baseline', 'candidate', promotionOptionsWithIgnoredGetter).canActivateAutomatically, false);
assert.equal(ignoredPromotionOptionGetterCalls, 0, 'unknown option getters must not be copied or invoked');

console.log('P23_VERIFIED_SKILL_PROMOTION_PROPOSAL=PASS');
