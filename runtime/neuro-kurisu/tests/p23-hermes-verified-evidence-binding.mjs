import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { signSkillShadowArtifactForFixture, verifySignedSkillShadowObservation } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';
import { skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const engine = new P23LearningEngine();
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const trustedKeys = new Map([['fixture-verifier', publicPem]]);
const candidate = {
  candidateId: 'candidate-7', skillId: 'skill-verify', version: 3,
  payload: { instructions: 'verify before acting' },
  payloadFingerprint: 'a'.repeat(64), proposalId: 'proposal-7',
  proposalOutcomeFingerprint: 'b'.repeat(64), baseVersion: 2, previousActive: null,
  status: 'shadow', shadowObservations: [], createdAt: 100,
};
function makeObservation({ runId = 'run-1', taskId = 'task-1', passed = true, version = 3 } = {}) {
  const payload = {
    schemaVersion: 1, artifactId: `artifact-${runId}`, candidateId: candidate.candidateId,
    skillId: candidate.skillId, candidateVersion: version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
    runId, taskId, manifestFingerprint: 'c'.repeat(64), seed: 11,
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
tampered.artifact.payload.passed = false;
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
console.log('P23_HERMES_VERIFIED_EVIDENCE_BINDING=PASS cryptographicReceipt=true identityBinding=true failClosed=true');
