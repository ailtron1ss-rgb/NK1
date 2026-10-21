import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AtomicFileTrustedSkillShadowRunRegistry, InMemoryTrustedSkillShadowRunRegistry } from '../src/organism/learning/TrustedSkillShadowRunRegistry.ts';
import { createContextBoundSkillShadowEvidenceVerifier, signSkillShadowArtifactForFixture, skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const dir = mkdtempSync(join(tmpdir(), 'nk1-trusted-shadow-run-'));
try {
  const file = join(dir, 'trusted-runs.json');
  const registry = new AtomicFileTrustedSkillShadowRunRegistry(file);
  const context = {
    runId: 'run-42', taskId: 'task-7', seed: 11,
    manifestFingerprint: 'a'.repeat(64), runtimeVersion: 'nk1-test-runtime',
  };
  registry.register(context);
  const restored = new AtomicFileTrustedSkillShadowRunRegistry(file);
  assert.equal(restored.snapshot().revision, 1);
  assert.equal(restored.snapshot().runs.length, 1);
  assert.equal(restored.register(context).runId, context.runId, 'same registration is idempotent');
  assert.equal(restored.snapshot().revision, 1, 'idempotent registration must not rewrite revision');
  assert.throws(() => restored.register({ ...context, seed: 12 }), /conflicting context/);

  const { generateKeyPairSync } = await import('node:crypto');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keys = new Map([['trusted-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
  const candidate = {
    candidateId: 'b'.repeat(64), skillId: 'skill-a', version: 1, payload: { skill: true },
    payloadFingerprint: 'c'.repeat(64), proposalId: 'd'.repeat(64), proposalOutcomeFingerprint: 'e'.repeat(64),
    baseVersion: null, previousActive: null, status: 'shadow', shadowObservations: [], createdAt: Date.now(),
  };
  const payload = {
    schemaVersion: 1, artifactId: 'artifact-1', candidateId: candidate.candidateId,
    skillId: candidate.skillId, candidateVersion: candidate.version, payloadFingerprint: candidate.payloadFingerprint,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint, runId: context.runId, taskId: context.taskId,
    manifestFingerprint: context.manifestFingerprint, seed: context.seed, runtimeVersion: context.runtimeVersion,
    passed: true, observedAt: Date.now(), verifierId: 'trusted-v1',
  };
  const artifact = signSkillShadowArtifactForFixture(payload, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  const observation = { runId: context.runId, evidenceFingerprint: skillShadowPayloadFingerprint(payload), passed: true, observedAt: payload.observedAt, artifact };
  const verify = createContextBoundSkillShadowEvidenceVerifier(keys, (o, c) => restored.resolve(o, c));
  assert.equal(verify(observation, candidate), true, 'signed receipt must match independently registered context');
  assert.equal(verify({ ...observation, artifact: { ...artifact, payload: { ...payload, seed: 12 } } }, candidate), false,
    'tampered receipt must fail signature verification');
  assert.equal(verify({ ...observation, runId: 'unregistered-run' }, candidate), false,
    'receipt cannot introduce its own trusted run context');

  const lockFd = openSync(file + '.lock', 'wx', 0o600);
  try { assert.throws(() => restored.register({ ...context, runId: 'other-run' }), /locked; fail closed/); }
  finally { closeSync(lockFd); rmSync(file + '.lock', { force: true }); }

  writeFileSync(file, JSON.stringify({ schemaVersion: 1, revision: 2, runs: [{ ...context, seed: -1, registeredAt: Date.now() }] }));
  assert.throws(() => restored.snapshot(), /schema is invalid/, 'corrupt trusted state must not be silently reset');

  const memory = new InMemoryTrustedSkillShadowRunRegistry();
  memory.register(context);
  assert.equal(memory.resolve(observation, candidate)?.seed, context.seed);
  assert.equal(memory.resolve({ ...observation, runId: 'missing' }, candidate), null);
  console.log('P23_TRUSTED_SKILL_SHADOW_RUN_REGISTRY=PASS');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
