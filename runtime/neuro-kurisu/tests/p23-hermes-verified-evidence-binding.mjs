import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { signSkillShadowArtifactForFixture, verifySignedSkillShadowObservation } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';
import { skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const engine = new P23LearningEngine();
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const trustedKeys = new Map([['fixture-verifier', publicPem]]);
const candidate = {
  candidateId: 'candidate-7', skillId: 'skill-verify', version: 3,
  payload: { instructions: 'verify before acting' },
  payloadFingerprint: digest({ instructions: 'verify before acting' }), proposalId: 'proposal-7',
  proposalOutcomeFingerprint: 'b'.repeat(64), baseVersion: 2, previousActive: null,
  status: 'shadow', shadowObservations: [], createdAt: 100,
};
function makeObservation({ runId = 'run-1', taskId = 'task-1', passed = true, version = 3, seed = 11, manifestFingerprint = 'c'.repeat(64) } = {}) {
  const payload = {
    schemaVersion: 1, artifactId: `artifact-${runId}`, candidateId: candidate.candidateId,
    skillId: candidate.skillId, candidateVersion: version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
    runId, taskId, manifestFingerprint, seed,
    runtimeVersion: 'nk-test-runtime', passed, observedAt: 1700000000000,
    verifierId: 'fixture-verifier',
  };
  const artifact = signSkillShadowArtifactForFixture(payload, privatePem);
  return {
    runId, passed, observedAt: payload.observedAt,
    evidenceFingerprint: skillShadowPayloadFingerprint(payload), artifact,
  };
}
function report(taskId = 'task-1', trialId = 'run-1', passed = true) {
  return {
    taskId, trialId,
    taskSuccess: { passed, passRate: passed ? 1 : 0 },
    skillQuality: {
      functionalCoverage: 1, executability: 1, safety: 1, aggregate: 1,
      missingCapabilityIds: [], safetyViolationCount: 0,
    },
    trajectoryQuality: {
      keyPointRecall: 1, executionOrder: 1, completeness: 1, aggregate: 1,
      missingStepIds: [], unexpectedStepIds: [],
    },
  };
}
const verifier = (observation, target) => verifySignedSkillShadowObservation(observation, target, trustedKeys);
const validObservation = makeObservation();
const valid = engine.bindReflectiveCandidateEvidence([report()], [validObservation], candidate, verifier);
assert.equal(valid.accepted, true);
assert.equal(valid.boundTrials, 1);
assert.equal(valid.manifestFingerprint, 'c'.repeat(64));
assert.equal(valid.boundEvidenceScope, 'identity-and-binary-outcome-only');
assert.equal(valid.qualityMetricsAuthenticated, false);

// Signed run receipts do not sign trajectory/skill-quality scores. Even a valid
// identity/outcome binding must not be described as cryptographic score attestation.
const inflatedQuality = structuredClone(report());
inflatedQuality.skillQuality.aggregate = 0;
inflatedQuality.trajectoryQuality.aggregate = 0;
const inflated = engine.bindReflectiveCandidateEvidence([inflatedQuality], [validObservation], candidate, verifier);
assert.equal(inflated.qualityMetricsAuthenticated, false);

const mismatchedTask = engine.bindReflectiveCandidateEvidence([report('task-other')], [validObservation], candidate, verifier);
assert.equal(mismatchedTask.accepted, false);
assert.ok(mismatchedTask.reasons.includes('reflective-trial-receipt-identity-mismatch'));

const mismatchedOutcome = engine.bindReflectiveCandidateEvidence([report('task-1', 'run-1', false)], [validObservation], candidate, verifier);
assert.equal(mismatchedOutcome.accepted, false);
assert.ok(mismatchedOutcome.reasons.includes('reflective-trial-outcome-mismatch'));

const wrongCandidateVersion = makeObservation({ version: 2 });
const versionRejected = engine.bindReflectiveCandidateEvidence([report()], [wrongCandidateVersion], candidate, verifier);
assert.equal(versionRejected.accepted, false);
assert.ok(versionRejected.reasons.includes('signed-shadow-evidence-not-trusted'));

const tampered = structuredClone(validObservation);
tampered.artifact.payload.runtimeVersion = 'tampered-runtime';
const tamperRejected = engine.bindReflectiveCandidateEvidence([report()], [tampered], candidate, verifier);
assert.equal(tamperRejected.accepted, false);
assert.ok(tamperRejected.reasons.includes('signed-shadow-evidence-not-trusted'));

const duplicateRun = engine.bindReflectiveCandidateEvidence([report()], [validObservation, validObservation], candidate, verifier);
assert.equal(duplicateRun.accepted, false);
assert.ok(duplicateRun.reasons.includes('duplicate-observation-run-id'));

const unmatchedReceipt = engine.bindReflectiveCandidateEvidence([report()], [validObservation, makeObservation({ runId: 'unmatched-run', taskId: 'task-extra' })], candidate, verifier);
assert.equal(unmatchedReceipt.accepted, false);
assert.ok(unmatchedReceipt.reasons.includes('unmatched-shadow-observation'));

const missingVerifier = engine.bindReflectiveCandidateEvidence([report()], [validObservation], candidate, () => false);
assert.equal(missingVerifier.accepted, false);

const independentEvaluation = {
  validation: [report('task-1', 'trial-1', true)],
  holdout: [report('task-2', 'trial-2', false)],
  provenance: {
    payloadFingerprint: candidate.payloadFingerprint,
    experimentAuthority: { manifestFingerprint: 'c'.repeat(64) },
    runBindings: [
      { taskId: 'task-1', trialId: 'trial-1', runId: 'run-1', plannedRunId: 'planned-1', seed: 11, split: 'validation', bindingVerified: true, verifierPassed: true, safetyViolationCount: 0 },
      { taskId: 'task-2', trialId: 'trial-2', runId: 'run-2', plannedRunId: 'planned-2', seed: 22, split: 'holdout', bindingVerified: true, verifierPassed: false, safetyViolationCount: 0 },
    ],
  },
};
const independentEnvelope = {
  payloadFingerprint: candidate.payloadFingerprint,
  evaluationFingerprint: digest(independentEvaluation),
  evaluation: independentEvaluation,
};
const independentReceipts = [
  validObservation,
  makeObservation({ runId: 'run-2', taskId: 'task-2', passed: false, seed: 22 }),
];
const independentBound = engine.bindIndependentEvaluationEvidence(
  independentEnvelope, independentReceipts, candidate, verifier,
);
assert.equal(independentBound.accepted, true,
  'P23 trial IDs must join to signed execution receipts through independently verified run bindings');
assert.equal(independentBound.boundTrials, 2);
assert.equal(independentBound.manifestFingerprint, 'c'.repeat(64));
assert.equal(independentBound.qualityMetricsAuthenticated, false);

const wrongCandidatePayload = engine.bindIndependentEvaluationEvidence(
  independentEnvelope, independentReceipts,
  { ...candidate, payloadFingerprint: 'e'.repeat(64) }, verifier,
);
assert.equal(wrongCandidatePayload.accepted, false,
  'signed receipts for one candidate must not bind an evaluation of a different payload');
assert.ok(wrongCandidatePayload.reasons.includes('independent-evaluation-candidate-payload-mismatch'));

const tamperedEnvelope = { ...independentEnvelope, evaluationFingerprint: 'f'.repeat(64) };
const tamperedEnvelopeBound = engine.bindIndependentEvaluationEvidence(
  tamperedEnvelope, independentReceipts, candidate, verifier,
);
assert.equal(tamperedEnvelopeBound.accepted, false,
  'receipt binding must reject a modified or mismatched evaluation digest');
assert.ok(tamperedEnvelopeBound.reasons.includes('independent-evaluation-envelope-integrity-invalid'));

const cyclicEvaluation = structuredClone(independentEvaluation);
cyclicEvaluation.provenance.self = cyclicEvaluation;
const cyclicEnvelopeBound = engine.bindIndependentEvaluationEvidence(
  { ...independentEnvelope, evaluation: cyclicEvaluation },
  independentReceipts, candidate, verifier,
);
assert.equal(cyclicEnvelopeBound.accepted, false,
  'cyclic or non-canonicalizable envelope data must fail closed instead of escaping the evidence gate');
assert.ok(cyclicEnvelopeBound.reasons.includes('independent-evaluation-envelope-not-canonicalizable'));

const nonFiniteEvaluation = structuredClone(independentEvaluation);
nonFiniteEvaluation.validation[0].skillQuality.aggregate = Number.NaN;
const nonFiniteEnvelopeBound = engine.bindIndependentEvaluationEvidence(
  { ...independentEnvelope, evaluation: nonFiniteEvaluation, evaluationFingerprint: digest(nonFiniteEvaluation) },
  independentReceipts, candidate, verifier,
);
assert.equal(nonFiniteEnvelopeBound.accepted, false,
  'non-finite evaluation metrics must not collapse to JSON null and pass canonical envelope integrity');
assert.ok(nonFiniteEnvelopeBound.reasons.includes('independent-evaluation-envelope-not-canonicalizable'));

const wrongSeedEvaluation = structuredClone(independentEvaluation);
wrongSeedEvaluation.provenance.runBindings[1].seed = 23;
const wrongSeedEnvelope = { ...independentEnvelope, evaluation: wrongSeedEvaluation, evaluationFingerprint: digest(wrongSeedEvaluation) };
const wrongSeedBound = engine.bindIndependentEvaluationEvidence(
  wrongSeedEnvelope, independentReceipts, candidate, verifier,
);
assert.equal(wrongSeedBound.accepted, false,
  'a signed receipt from another seed must not bind to an independent evaluation trial');
assert.ok(wrongSeedBound.reasons.includes('independent-evaluation-signed-receipt-mismatch'));

const missingSafetyBinding = structuredClone(independentEvaluation);
missingSafetyBinding.provenance.runBindings[0].safetyViolationCount = 1;
const unsafeEnvelope = { ...independentEnvelope, evaluation: missingSafetyBinding, evaluationFingerprint: digest(missingSafetyBinding) };
const unsafeBound = engine.bindIndependentEvaluationEvidence(
  unsafeEnvelope, independentReceipts, candidate, verifier,
);
assert.equal(unsafeBound.accepted, false,
  'signed identity evidence cannot rescue a safety-violating evaluation');
assert.ok(unsafeBound.reasons.includes('independent-evaluation-run-untrusted'));

console.log('P23_HERMES_VERIFIED_EVIDENCE_BINDING=PASS cryptographicReceipt=true identityBinding=true p23Join=true failClosed=true');
