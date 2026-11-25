import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  createContextBoundSkillShadowEvidenceVerifier,
  signSkillShadowArtifactForFixture,
  skillShadowPayloadFingerprint,
} from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const keys = new Map([['freshness-verifier', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const candidate = {
  candidateId: 'a'.repeat(64), skillId: 'freshness-skill', version: 2,
  payload: { instruction: 'perform bounded task' }, payloadFingerprint: 'b'.repeat(64),
  proposalId: 'c'.repeat(64), proposalOutcomeFingerprint: 'd'.repeat(64),
  baseVersion: 1, previousActive: null, status: 'shadow', shadowObservations: [], createdAt: 1,
};
const now = 1_800_000_000_000;
const payload = {
  schemaVersion: 1, artifactId: 'freshness-artifact', candidateId: candidate.candidateId,
  skillId: candidate.skillId, candidateVersion: candidate.version,
  payloadFingerprint: candidate.payloadFingerprint,
  proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
  runId: 'freshness-run', taskId: 'task-1', manifestFingerprint: 'e'.repeat(64),
  seed: 11, runtimeVersion: 'nk1-runtime-1', passed: true,
  observedAt: now - 500, verifierId: 'freshness-verifier',
};
const artifact = signSkillShadowArtifactForFixture(payload, privatePem);
const observation = {
  runId: payload.runId, evidenceFingerprint: skillShadowPayloadFingerprint(payload),
  passed: true, observedAt: payload.observedAt, artifact,
};
const context = () => ({
  runId: payload.runId, taskId: payload.taskId, seed: payload.seed,
  manifestFingerprint: payload.manifestFingerprint, runtimeVersion: payload.runtimeVersion,
});
const verify = createContextBoundSkillShadowEvidenceVerifier(keys, context, {
  maxAgeMs: 1_000, maxFutureSkewMs: 100, now: () => now,
});
assert.equal(verify(observation, candidate, 'record'), true,
  'fresh evidence bound to candidate, manifest, seed and runtime is accepted');
assert.equal(verify(observation, candidate, 'promotion'), true,
  'fresh evidence can authorize promotion when trusted run context matches');
const stalePayload = { ...payload, observedAt: now - 1_001 };
const staleArtifact = signSkillShadowArtifactForFixture(stalePayload, privatePem);
const staleObservation = {
  runId: stalePayload.runId, evidenceFingerprint: skillShadowPayloadFingerprint(stalePayload),
  passed: true, observedAt: stalePayload.observedAt, artifact: staleArtifact,
};
assert.equal(verify(staleObservation, candidate, 'record'), false,
  'stale evidence cannot enter the candidate lifecycle');
assert.equal(verify(staleObservation, candidate, 'promotion'), false,
  'stale evidence cannot authorize promotion');
assert.equal(verify(staleObservation, candidate, 'persisted-active'), true,
  'already-promoted skills remain verifiable after their evidence freshness window expires');
const futurePayload = { ...payload, observedAt: now + 101 };
const futureArtifact = signSkillShadowArtifactForFixture(futurePayload, privatePem);
const futureObservation = {
  runId: futurePayload.runId, evidenceFingerprint: skillShadowPayloadFingerprint(futurePayload),
  passed: true, observedAt: futurePayload.observedAt, artifact: futureArtifact,
};
assert.equal(verify(futureObservation, candidate, 'record'), false,
  'evidence timestamp beyond allowed clock skew is rejected');
assert.equal(verify(futureObservation, candidate, 'persisted-active'), false,
  'implausibly future-dated evidence is rejected even when re-verifying an active skill');
assert.throws(() => createContextBoundSkillShadowEvidenceVerifier(keys, context, {
  maxAgeMs: 0, now: () => now,
}), /invalid skill shadow evidence freshness policy/);
assert.throws(() => createContextBoundSkillShadowEvidenceVerifier(keys, context, {
  maxFutureSkewMs: 24 * 60 * 60 * 1000 + 1, now: () => now,
}), /invalid skill shadow evidence freshness policy/);
console.log('P23_SKILL_SHADOW_EVIDENCE_FRESHNESS=PASS');
