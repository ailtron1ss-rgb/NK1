import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { synapticReplayHistoryCommitment } from '../src/organism/learning/AdaptiveSynapticMatrix.ts';

const hash = char => char.repeat(64);
const candidate = {
  id: 'p25-replay-anchor-lora-v1',
  artifactRef: 'file:adapters/p25-replay-anchor-lora-v1.safetensors',
  artifactSha256: hash('a'),
  adapterFormat: 'lora',
  rank: 8,
  baseModelId: 'nk1-p25-anchor-test',
  baseModelRevisionSha256: hash('c'),
  tasks: ['language'],
  competenceByTask01: { language: 0.94 },
  conflictGroup: 'p25-anchor-test',
  minimumConfidence01: 0.4,
  maximumResourceRisk01: 0.8,
  maximumUncertainty01: 0.7,
  maximumContextTokens: 8192,
  trainingDatasetRef: 'dataset://p25-anchor/train',
  owner: 'p25-replay-anchor-test',
};
const manifest = (reportId, digest) => ({
  ...candidate,
  validation: {
    reportId,
    reportSha256: hash(digest),
    holdoutDatasetRef: 'dataset://p25-anchor/holdout/' + reportId,
    pairedSeeds: 8,
    baselineScore01: 0.70,
    adapterScore01: 0.82,
    lower95Delta01: 0.04,
    guardrailRegressionCount: 0,
  },
  signerKeyId: 'p25-replay-anchor-validator',
  signature: 'valid:' + reportId,
});

function createAnchorStore({ rejectCas = false, throwOnRead = false } = {}) {
  const rows = new Map();
  return {
    rows,
    async read(adapterId) {
      if (throwOnRead) throw new Error('synthetic-anchor-store-unavailable');
      const value = rows.get(adapterId);
      return value ? { ...value } : null;
    },
    async compareAndSwap(adapterId, expected, next) {
      if (rejectCas) return false;
      const current = rows.get(adapterId) ?? null;
      const same = current === null
        ? expected === null
        : expected !== null
          && current.acceptedReportCount === expected.acceptedReportCount
          && current.acceptedReportHistorySha256 === expected.acceptedReportHistorySha256;
      if (!same) return false;
      const expectedCount = (current?.acceptedReportCount ?? 0) + 1;
      if (!Number.isSafeInteger(next.acceptedReportCount) || next.acceptedReportCount !== expectedCount) return false;
      if (!/^[a-f0-9]{64}$/.test(next.acceptedReportHistorySha256)) return false;
      if (!/^[a-f0-9]{64}$/.test(next.latestReportSha256)) return false;
      rows.set(adapterId, {
        acceptedReportCount: next.acceptedReportCount,
        acceptedReportHistorySha256: next.acceptedReportHistorySha256,
      });
      return true;
    },
  };
}

function createRuntime(stateFile, anchorStore, overrides = {}) {
  return new OrganismRuntime({
    stateFile,
    worldStateFile: stateFile.replace(/\.json$/i, '.world.json'),
    enableLanguage: true,
    autoRun: false,
    performanceProfile: 'mobile',
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    languageInvoker: async () => ({ text: 'base fallback', backend: 'test-base', latencyMs: 2 }),
    synapticBaseModelId: candidate.baseModelId,
    synapticBaseModelRevisionSha256: candidate.baseModelRevisionSha256,
    synapticAdapterManifestVerifier: (payload, signature, keyId) =>
      keyId === 'p25-replay-anchor-validator'
      && signature.startsWith('valid:')
      && payload.includes('"reportId":"'),
    synapticReplayAnchorStore: anchorStore,
    synapticReplayAnchorRequired: true,
    synapticAdapterInvoker: async (_request, selected) => ({
      text: 'specialist response',
      backend: 'test-specialist',
      latencyMs: 3,
      modelId: selected.baseModelId,
      modelRevisionSha256: selected.baseModelRevisionSha256,
      appliedAdapterSha256: selected.artifactSha256,
      adapterApplied: true,
    }),
    ...overrides,
  });
}

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p25-monotonic-anchor-'));
const stateFile = path.join(dir, 'organism.json');
const matrixFile = stateFile + '.synaptic-matrix.json';
const anchorStore = createAnchorStore();
const runtimes = [];
const stop = async runtime => {
  if (runtime) {
    await runtime.stop();
    runtimes.splice(runtimes.indexOf(runtime), 1);
  }
};

try {
  // A fresh candidate may be staged with no anchor row, but activation must claim
  // the first report using an atomic external compare-and-swap.
  const first = createRuntime(stateFile, anchorStore);
  runtimes.push(first);
  await first.init();
  await first.registerSynapticAdapterCandidate(candidate);
  const preActivationSnapshot = first.synapticMatrixSnapshot();
  const firstManifest = manifest('p25-anchor-first', 'b');
  await first.activateSynapticAdapter(firstManifest);
  const localAfterFirstActivation = first.synapticMatrixSnapshot().adapters[0];
  const externalAfterFirstActivation = anchorStore.rows.get(candidate.id);
  assert.equal(localAfterFirstActivation.status, 'active');
  assert.equal(externalAfterFirstActivation.acceptedReportCount, 1);
  assert.equal(
    externalAfterFirstActivation.acceptedReportHistorySha256,
    synapticReplayHistoryCommitment([firstManifest.validation.reportSha256]),
    'host anchor commits the exact accepted report sequence',
  );
  await stop(first);

  // The same adapter can restore only when the host monotonic anchor matches.
  const restored = createRuntime(stateFile, anchorStore);
  runtimes.push(restored);
  await restored.init();
  assert.equal(restored.synapticMatrixSnapshot().adapters[0].status, 'active');
  await assert.rejects(
    restored.activateSynapticAdapter(firstManifest),
    /report-replay/i,
    'a failed replay attempt must not disable an already active adapter',
  );
  assert.equal(restored.synapticMatrixSnapshot().adapters[0].status, 'active');
  await stop(restored);

  // Roll the local sidecar back to a pre-activation snapshot while leaving the
  // independently stored anchor at count=1. Restore must quarantine the adapter.
  await writeFile(matrixFile, JSON.stringify(preActivationSnapshot), 'utf8');
  const rollbackDetected = createRuntime(stateFile, anchorStore);
  runtimes.push(rollbackDetected);
  await rollbackDetected.init();
  const rolledBackRecord = rollbackDetected.synapticMatrixSnapshot().adapters[0];
  assert.equal(rolledBackRecord.status, 'quarantined');
  assert.equal(rolledBackRecord.activationHistorySaturated, true);
  const fallback = await rollbackDetected.step('Answer using the validated specialist.', { deliberate: false });
  assert.equal(fallback.language?.text, 'base fallback',
    'a rolled-back local snapshot must not route to the specialist');
  await stop(rollbackDetected);

  // A strict deployment cannot activate when no trusted external anchor exists.
  const missingAnchor = createRuntime(path.join(dir, 'missing-anchor.json'), undefined);
  runtimes.push(missingAnchor);
  await missingAnchor.init();
  await missingAnchor.registerSynapticAdapterCandidate(candidate);
  await assert.rejects(
    missingAnchor.activateSynapticAdapter(manifest('p25-anchor-missing', 'd')),
    /monotonic-replay-anchor-required/i,
  );
  assert.notEqual(missingAnchor.synapticMatrixSnapshot().adapters[0].status, 'active');
  await stop(missingAnchor);

  // A compare-and-swap conflict never leaves the candidate active in memory.
  const casFailureStore = createAnchorStore({ rejectCas: true });
  const casFailure = createRuntime(path.join(dir, 'cas-failure.json'), casFailureStore);
  runtimes.push(casFailure);
  await casFailure.init();
  await casFailure.registerSynapticAdapterCandidate(candidate);
  await assert.rejects(
    casFailure.activateSynapticAdapter(manifest('p25-anchor-cas-failure', 'e')),
    /compare-and-swap-failed/i,
  );
  assert.notEqual(casFailure.synapticMatrixSnapshot().adapters[0].status, 'active');
  assert.equal(casFailure.synapticMatrixSnapshot().adapters[0].acceptedReportCount, 1,
    'the failed local activation remains consumed and cannot be replayed');
  await stop(casFailure);

  // Anchor storage errors fail closed for a fresh candidate and do not create a
  // poisoned activation history before a report has been accepted.
  const unavailableStore = createAnchorStore({ throwOnRead: true });
  const unavailable = createRuntime(path.join(dir, 'anchor-unavailable.json'), unavailableStore);
  runtimes.push(unavailable);
  await unavailable.init();
  await unavailable.registerSynapticAdapterCandidate(candidate);
  await assert.rejects(
    unavailable.activateSynapticAdapter(manifest('p25-anchor-unavailable', 'f')),
    /replay-anchor-unavailable/i,
  );
  assert.equal(unavailable.synapticMatrixSnapshot().adapters[0].acceptedReportCount, 0);
  assert.notEqual(unavailable.synapticMatrixSnapshot().adapters[0].status, 'active');
  await stop(unavailable);

  console.log('P25_SYNAPTIC_MONOTONIC_REPLAY_ANCHOR=PASS rollbackDetected=1 replayRejected=1 casFailClosed=1');
} finally {
  await Promise.all(runtimes.map(runtime => runtime.stop().catch(() => {})));
  await rm(dir, { recursive: true, force: true });
}
