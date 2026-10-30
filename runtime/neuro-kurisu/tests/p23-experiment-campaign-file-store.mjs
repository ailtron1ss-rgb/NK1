import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ExperimentCampaignRegistryFileStore } from '../src/organism/learning/ExperimentCampaignRegistryFileStore.ts';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-campaign-registry-'));
try {
  const file = path.join(dir, 'campaigns', 'registry.json');
  const store = new ExperimentCampaignRegistryFileStore(file);
  const manifest = [{
    taskId: 'task-memory',
    family: 'memory',
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('durable holdout reservation'),
    verifierId: 'verifier-v1',
    version: '1',
  }];
  const plan = createLearningExperimentPlan(manifest, {
    split: 'holdout',
    seeds: [11, 13],
    resetEvery: [1],
    priorMethod: 'baseline-v1',
    continuousMethod: 'candidate-v1',
    resetMethodPrefix: 'reset-',
  });
  const input = {
    campaignId: 'durable-campaign-01',
    plan,
    manifest,
    baselineMethod: 'baseline-v1',
    baselineFingerprint: hash('baseline-config'),
    candidateFingerprints: {
      'candidate-v1': hash('candidate-config'),
      'reset-1': hash('reset-config'),
    },
    primaryMetric: 'pass-rate',
    registeredAt: 1_800_000_000_000,
  };

  const registration = await store.transact(registry => registry.register(input));
  assert.equal(registration.campaignId, input.campaignId);
  assert.ok((await stat(file)).isFile());
  assert.ok(!await stat(file + '.lock').then(() => true).catch(() => false),
    'transaction lock must be released after commit');

  const restartedStore = new ExperimentCampaignRegistryFileStore(file);
  const restored = await restartedStore.load();
  assert.equal(restored.get(input.campaignId).status, 'registered',
    'holdout reservation must survive a process restart through durable snapshot restore');
  assert.equal(restored.get(input.campaignId).registration.registrationFingerprint,
    registration.registrationFingerprint);

  await assert.rejects(
    restartedStore.transact(registry => registry.register({
      ...input, campaignId: 'durable-campaign-02',
    })),
    /already reserved/,
    'a second process/store instance must not reserve the same holdout manifest again',
  );
  assert.equal((await restartedStore.load()).list().length, 1,
    'a failed transaction must not persist partial in-memory changes');

  await assert.rejects(
    restartedStore.transact(registry => {
      registry.register({
        ...input,
        campaignId: 'durable-campaign-03',
        manifest: [{
          ...manifest[0],
          taskId: 'task-other',
          promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('another holdout set'),
        }],
        plan: createLearningExperimentPlan([{
          ...manifest[0],
          taskId: 'task-other',
          promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('another holdout set'),
        }], {
          split: 'holdout', seeds: [11, 13], resetEvery: [1],
          priorMethod: 'baseline-v1', continuousMethod: 'candidate-v1', resetMethodPrefix: 'reset-',
        }),
      });
      throw new Error('simulated transaction abort');
    }),
    /simulated transaction abort/,
  );
  assert.equal((await restartedStore.load()).list().length, 1,
    'callback failure must roll back unsaved registry mutations');
  assert.ok(!await stat(file + '.lock').then(() => true).catch(() => false),
    'transaction lock must be released after callback failure');

  const lockPath = file + '.lock';
  const externalLock = await open(lockPath, 'wx', 0o600);
  try {
    await assert.rejects(
      restartedStore.transact(registry => registry.list()),
      /locked/,
      'a concurrent or stale lock must fail closed instead of overwriting another process',
    );
  } finally {
    await externalLock.close();
    await rm(lockPath, { force: true });
  }

  const serialized = await readFile(file, 'utf8');
  const corruptedFile = path.join(dir, 'campaigns', 'corrupt.json');
  await writeFile(corruptedFile, serialized.replace('durable-campaign-01', 'tampered-campaign-01'), 'utf8');
  await assert.rejects(new ExperimentCampaignRegistryFileStore(corruptedFile).load(),
    /checksum mismatch|fingerprint mismatch/,
    'a modified durable snapshot must be rejected');

  const tooSmall = new ExperimentCampaignRegistryFileStore(path.join(dir, 'small.json'), 32);
  await assert.rejects(
    tooSmall.transact(registry => registry.register(input)),
    /size limit/,
  );
  assert.ok(!await stat(path.join(dir, 'small.json') + '.lock').then(() => true).catch(() => false),
    'size-limit failure must not strand the transaction lock');

  console.log('P23_EXPERIMENT_CAMPAIGN_FILE_STORE=PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
