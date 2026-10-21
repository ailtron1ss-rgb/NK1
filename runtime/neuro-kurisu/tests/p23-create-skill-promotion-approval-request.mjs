import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSkillPromotionApprovalRequest } from '../scripts/create-skill-promotion-approval-request.mjs';
import { AtomicFileTrustedSkillShadowRunRegistry } from '../src/organism/learning/TrustedSkillShadowRunRegistry.ts';
import { signSkillShadowArtifactForFixture, skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
};
const fingerprint = value => createHash('sha256').update(canonical(value)).digest('hex');
const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-promotion-request-'));
try {
  const payload = {
    id: 'candidate-memory-skill', contextKey: 'memory:partial', action: 'verify',
    totalUses: 12, trainUses: 8, validationUses: 4, trainSuccess01: 0.75,
    validationSuccess01: 0.75, confidence01: 0.74, status: 'candidate',
    createdAt: 1000, updatedAt: 2000, validationWindowStartTick: 1, validationWindowEndTick: 12,
  };
  const proposalId = 'a'.repeat(64);
  const payloadFingerprint = fingerprint(payload);
  const candidateId = createHash('sha256').update(JSON.stringify([
    payload.id, 1, proposalId, payloadFingerprint,
  ])).digest('hex');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const verifierId = 'promotion-request-fixture-verifier';
  const registryPath = path.join(root, 'trusted-runs.json');
  const registry = new AtomicFileTrustedSkillShadowRunRegistry(registryPath);
  const observations = [1, 2, 3].map(n => {
    const runId = `run-${n}`, taskId = `task-${n}`, seed = n;
    const context = { runId, taskId, seed, manifestFingerprint: 'c'.repeat(64), runtimeVersion: 'fixture-runtime' };
    registry.register(context);
    const signedPayload = {
      schemaVersion: 1, artifactId: `artifact-${n}`, candidateId, skillId: payload.id,
      candidateVersion: 1, payloadFingerprint, proposalOutcomeFingerprint: 'b'.repeat(64),
      runId, taskId, manifestFingerprint: context.manifestFingerprint, seed,
      runtimeVersion: context.runtimeVersion, passed: true, observedAt: 3000 + n, verifierId,
    };
    return {
      runId, evidenceFingerprint: skillShadowPayloadFingerprint(signedPayload), passed: true,
      observedAt: signedPayload.observedAt, artifact: signSkillShadowArtifactForFixture(signedPayload, privatePem),
    };
  });
  const candidate = {
    candidateId, skillId: payload.id, version: 1, payload, payloadFingerprint,
    proposalId, proposalOutcomeFingerprint: 'b'.repeat(64), baseVersion: null, previousActive: null,
    status: 'shadow', shadowObservations: observations, createdAt: 1000,
  };
  const storePath = path.join(root, 'candidates.json');
  const snapshot = { schemaVersion: 1, revision: 7, active: [], candidates: [candidate] };
  await writeFile(storePath, JSON.stringify(snapshot));
  const options = { storePath, registryPath, rawVerifierKeys: JSON.stringify({ [verifierId]: publicPem }), candidateId };
  const request = await createSkillPromotionApprovalRequest({
    ...options, approverId: 'reviewer-1', approvalId: 'approval-unique-1',
    minShadowRuns: 3, now: 5000,
  });
  assert.equal(request.status, 'approval-request-only');
  assert.equal(request.signingAlgorithm, 'Ed25519');
  assert.equal(request.payload.candidateId, candidateId);
  assert.equal(request.payload.expectedActiveVersion, null);
  assert.equal(request.payload.minShadowRuns, 3);
  assert.equal(request.payload.shadowEvidenceFingerprint.length, 64);
  assert.match(request.warning, /does not authorize activation/);

  const tamperedCandidate = {
    ...candidate,
    shadowObservations: candidate.shadowObservations.map((observation, index) => index === 0
      ? { ...observation, artifact: { ...observation.artifact, signature: 'AAAA' } }
      : observation),
  };
  await writeFile(storePath, JSON.stringify({ ...snapshot, candidates: [tamperedCandidate] }));
  await assert.rejects(
    () => createSkillPromotionApprovalRequest({ ...options, approverId: 'reviewer-1', approvalId: 'approval-tampered', now: 5000 }),
    /fails signature or trusted-run context verification/,
  );
  await writeFile(storePath, JSON.stringify(snapshot));

  await assert.rejects(
    () => createSkillPromotionApprovalRequest({ ...options, approverId: 'reviewer-1', approvalId: 'approval-2', minShadowRuns: 4, now: 5000 }),
    /does not satisfy the requested all-passing shadow run threshold/,
  );
  const staged = { ...snapshot, candidates: [{ ...candidate, status: 'staged' }] };
  await writeFile(storePath, JSON.stringify(staged));
  await assert.rejects(
    () => createSkillPromotionApprovalRequest({ ...options, approverId: 'reviewer-1', approvalId: 'approval-3', now: 5000 }),
    /require a shadow candidate/,
  );
  const changedBase = { ...snapshot, active: [{ skillId: payload.id, version: 2 }], candidates: [candidate] };
  await writeFile(storePath, JSON.stringify(changedBase));
  await assert.rejects(
    () => createSkillPromotionApprovalRequest({ ...options, approverId: 'reviewer-1', approvalId: 'approval-4', now: 5000 }),
    /base version does not match current active version/,
  );
  console.log('P23_CREATE_SKILL_PROMOTION_APPROVAL_REQUEST=PASS candidate/evidence/CAS-bound unsigned request and default-deny boundaries');
} finally {
  await rm(root, { recursive: true, force: true });
}
