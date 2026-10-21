import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { bindReflectiveReportsToVerifiedShadowEvidence } from '../src/organism/learning/HermesVerifiedEvidenceBinding.ts';
import { signSkillShadowArtifactForFixture, verifySignedSkillShadowObservation } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';
import { skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

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
const valid = bindReflectiveReportsToVerifiedShadowEvidence([report()], [validObservation], candidate, verifier);
assert.equal(valid.accepted, true);
assert.equal(valid.boundTrials, 1);
assert.equal(valid.manifestFingerprint, 'c'.repeat(64));

const mismatchedTask = bindReflectiveReportsToVerifiedShadowEvidence([report('task-other')], [validObservation], candidate, verifier);
assert.equal(mismatchedTask.accepted, false);
assert.ok(mismatchedTask.reasons.includes('reflective-trial-receipt-identity-mismatch'));

const mismatchedOutcome = bindReflectiveReportsToVerifiedShadowEvidence([report('task-1', 'run-1', false)], [validObservation], candidate, verifier);
assert.equal(mismatchedOutcome.accepted, false);
assert.ok(mismatchedOutcome.reasons.includes('reflective-trial-outcome-mismatch'));

const wrongCandidateVersion = makeObservation({ version: 2 });
const versionRejected = bindReflectiveReportsToVerifiedShadowEvidence([report()], [wrongCandidateVersion], candidate, verifier);
assert.equal(versionRejected.accepted, false);
assert.ok(versionRejected.reasons.includes('signed-shadow-evidence-not-trusted'));

const tampered = structuredClone(validObservation);
tampered.artifact.payload.passed = false;
const tamperRejected = bindReflectiveReportsToVerifiedShadowEvidence([report()], [tampered], candidate, verifier);
assert.equal(tamperRejected.accepted, false);
assert.ok(tamperRejected.reasons.includes('signed-shadow-evidence-not-trusted'));

const duplicateRun = bindReflectiveReportsToVerifiedShadowEvidence([report()], [validObservation, validObservation], candidate, verifier);
assert.equal(duplicateRun.accepted, false);
assert.ok(duplicateRun.reasons.includes('duplicate-observation-run-id'));

const missingVerifier = bindReflectiveReportsToVerifiedShadowEvidence([report()], [validObservation], candidate, () => false);
assert.equal(missingVerifier.accepted, false);
console.log('P23_HERMES_VERIFIED_EVIDENCE_BINDING=PASS cryptographicReceipt=true identityBinding=true failClosed=true');
