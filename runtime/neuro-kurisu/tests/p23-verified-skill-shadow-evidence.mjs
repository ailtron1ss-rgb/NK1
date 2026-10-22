import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signSkillShadowArtifactForFixture, skillShadowPayloadFingerprint, verifySignedSkillShadowObservation } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeys = new Map([['shadow-verifier-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const candidate = {
  candidateId: 'a'.repeat(64), skillId: 'memory-repair', version: 3,
  payload: { instruction: 'repair recall' }, payloadFingerprint: 'b'.repeat(64),
  proposalId: 'c'.repeat(64), proposalOutcomeFingerprint: 'd'.repeat(64), baseVersion: 2,
  previousActive: null, status: 'shadow', shadowObservations: [], createdAt: 100,
};
const payload = {
  schemaVersion: 1, artifactId: 'shadow-artifact-1', candidateId: candidate.candidateId,
  skillId: candidate.skillId, candidateVersion: candidate.version, payloadFingerprint: candidate.payloadFingerprint,
  proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint, runId: 'shadow-run-1',
  taskId: 'holdout-task-7', manifestFingerprint: 'e'.repeat(64), seed: 7,
  runtimeVersion: 'nk1-runtime-test-1', passed: true, observedAt: 1700000000000,
  verifierId: 'shadow-verifier-v1',
};
const artifact = signSkillShadowArtifactForFixture(payload, privateKeyPem);
const observation = {
  runId: payload.runId, evidenceFingerprint: skillShadowPayloadFingerprint(payload),
  passed: payload.passed, observedAt: payload.observedAt, artifact,
};
assert.equal(verifySignedSkillShadowObservation(observation, candidate, trustedKeys), true,
  'valid signed receipt bound to the exact candidate is accepted');
assert.equal(verifySignedSkillShadowObservation(observation, { ...candidate, version: 4 }, trustedKeys), false,
  'receipt cannot be replayed for another candidate version');
assert.equal(verifySignedSkillShadowObservation(observation, candidate, new Map()), false,
  'unknown verifier key is denied');
const tampered = { ...observation, artifact: { ...artifact, payload: { ...payload, passed: false } } };
assert.equal(verifySignedSkillShadowObservation(tampered, candidate, trustedKeys), false,
  'tampered outcome does not verify');
assert.equal(verifySignedSkillShadowObservation({ ...observation, evidenceFingerprint: 'f'.repeat(64) }, candidate, trustedKeys), false,
  'caller cannot substitute the evidence fingerprint');
console.log('P23_SIGNED_SKILL_SHADOW_EVIDENCE=PASS');
