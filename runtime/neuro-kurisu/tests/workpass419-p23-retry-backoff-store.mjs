import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { P23CompoundRepairRevisionCoordinator } from '../src/organism/learning/P23CompoundRepairRevisionCoordinator.ts';

const evidence = [{
  skillId: 'durable-retry-skill',
  skillName: 'fallback',
  failureFingerprint: 'durable-failure-fingerprint',
  stepId: 'step-1',
  failedTool: 'primary',
  diagnosis: 'repeatable failure used to test durable retry cooldown',
  contextSignature: 'durable-context',
  candidateTools: ['fallback'],
  selectedTool: 'fallback',
  verified: true,
  confidence01: 0.9,
  observedAt: 10,
  revisionEligible: true,
}];

const directory = await mkdtemp(join(tmpdir(), 'nk1-p23-retry-backoff-'));
try {
  const statePath = join(directory, 'repair-retry-backoff.json');
  const runtime = {
    compoundSkillRepairEvidence: () => evidence,
    generateCompoundSkillRevision: async () => {
      throw new Error('cooldown regression must not stage a candidate');
    },
  };
  const engine = {};
  let providerCalls = 0;
  const firstStore = new FileStateStore(statePath, { backupEverySaves: 1 });
  const first = new P23CompoundRepairRevisionCoordinator(
    runtime,
    engine,
    async () => {
      providerCalls++;
      throw new Error('intentional provider failure for file-backed retry test');
    },
    firstStore,
  );

  await assert.rejects(
    () => first.reviseFromObservedRepairs('durable-retry-skill'),
    /intentional provider failure for file-backed retry test/,
  );
  const saved = await firstStore.load();
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.entries[0].skillId, 'durable-retry-skill');
  assert.equal(saved.entries[0].attempts, 1);

  // A fresh store + coordinator models a process restart; no in-memory map is shared.
  const secondStore = new FileStateStore(statePath, { backupEverySaves: 1 });
  const restarted = new P23CompoundRepairRevisionCoordinator(
    runtime,
    engine,
    async () => {
      providerCalls++;
      throw new Error('provider must remain throttled after reload');
    },
    secondStore,
  );
  await restarted.restoreRetryBackoff();
  assert.equal(restarted.retryBackoffPersistenceDiagnostics().available, true);
  const result = await restarted.reviseFromObservedRepairs('durable-retry-skill');
  assert.equal(result.status, 'retry-backoff-active');
  assert.ok(result.retryInMs > 0 && result.retryInMs <= 30 * 60 * 1000);
  assert.equal(providerCalls, 1, 'filesystem-restored cooldown must skip a duplicate expensive provider call');
  assert.equal(restarted.retryBackoffDiagnostics()[0].durable, true);

  // New evidence remains eligible and gets its own retry budget.
  evidence[0] = { ...evidence[0], failureFingerprint: 'new-durable-evidence' };
  await assert.rejects(
    () => restarted.reviseFromObservedRepairs('durable-retry-skill'),
    /provider must remain throttled after reload/,
  );
  assert.equal(providerCalls, 2, 'different evidence digest bypasses the prior cooldown');
  const updated = await secondStore.load();
  assert.notEqual(updated.entries[0].evidenceDigest, saved.entries[0].evidenceDigest);
  assert.equal(updated.entries[0].attempts, 1);
  console.log('WORKPASS419_P23_RETRY_BACKOFF_FILE_STORE=PASS');
} finally {
  await rm(directory, { recursive: true, force: true });
}
