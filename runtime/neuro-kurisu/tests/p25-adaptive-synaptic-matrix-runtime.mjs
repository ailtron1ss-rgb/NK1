import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const hash = char => char.repeat(64);
const candidate = {
  id: 'runtime-physics-lora-v1',
  artifactRef: 'file:adapters/runtime-physics-lora-v1.safetensors',
  artifactSha256: hash('a'),
  adapterFormat: 'lora',
  rank: 8,
  baseModelId: 'nk1-runtime-test',
  baseModelRevisionSha256: hash('c'),
  tasks: ['language'],
  competenceByTask01: { language: 0.96 },
  conflictGroup: 'runtime-physics',
  minimumConfidence01: 0.4,
  maximumResourceRisk01: 1,
  maximumUncertainty01: 1,
  maximumContextTokens: 64_000,
  trainingDatasetRef: 'dataset://runtime/train',
  owner: 'p25-runtime-test',
};
const manifest = {
  ...candidate,
  validation: {
    reportId: 'runtime-holdout-2026-11',
    reportSha256: hash('b'),
    holdoutDatasetRef: 'dataset://runtime/holdout',
    pairedSeeds: 8,
    baselineScore01: 0.70,
    adapterScore01: 0.82,
    lower95Delta01: 0.04,
    guardrailRegressionCount: 0,
  },
  signerKeyId: 'runtime-test-validator',
  signature: 'runtime-test-signature',
};

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p25-runtime-'));
const stateFile = path.join(dir, 'organism.json');
let baseCalls = 0;
let adapterCalls = 0;
let failAdapter = false;
const baseInvoker = async () => {
  baseCalls += 1;
  return { text: 'base response', backend: 'test-base', latencyMs: 3 };
};
const adapterInvoker = async (_request, selected) => {
  adapterCalls += 1;
  assert.equal(selected.id, candidate.id);
  if (failAdapter) throw new Error('synthetic-adapter-load-failure');
  return { text: 'specialized response', backend: 'test-specialist', latencyMs: 4 };
};
const makeRuntime = () => new OrganismRuntime({
  stateFile,
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: true,
  autoRun: false,
  performanceProfile: 'mobile',
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  languageInvoker: baseInvoker,
  synapticBaseModelId: candidate.baseModelId,
  synapticBaseModelRevisionSha256: candidate.baseModelRevisionSha256,
  synapticAdapterManifestVerifier: (payload, signature, keyId) =>
    payload.includes('"reportId":"runtime-holdout-2026-11"')
      && signature === manifest.signature
      && keyId === manifest.signerKeyId,
  synapticAdapterInvoker: adapterInvoker,
});

try {
  let runtime = makeRuntime();
  await runtime.init();

  const initial = await runtime.step('Check the supplied facts and answer cautiously.');
  assert.equal(initial.language?.text, 'base response');
  assert.equal(baseCalls, 1);
  assert.equal(adapterCalls, 0, 'no adapter can route before a candidate is registered and validated');

  await runtime.registerSynapticAdapterCandidate(candidate);
  await runtime.activateSynapticAdapter(manifest);
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'active');

  const specialized = await runtime.step('Solve this physics reasoning question.');
  assert.equal(specialized.language?.text, 'specialized response');
  assert.equal(adapterCalls, 1);
  assert.equal(baseCalls, 1, 'successful specialist inference must not also invoke the base model');

  failAdapter = true;
  const recovered = await runtime.step('Try the specialist, but preserve the base fallback.');
  assert.equal(recovered.language?.text, 'base response');
  assert.equal(adapterCalls, 2);
  assert.equal(baseCalls, 2, 'adapter failure must execute the original base invoker exactly once');
  assert.ok(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures >= 1);

  await runtime.stop();
  runtime = makeRuntime();
  await runtime.init();
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'active',
    'a valid signed activation receipt must survive restart when the host verifier remains available');

  await runtime.disableSynapticAdapter(candidate.id);
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'disabled');
  const disabled = await runtime.step('Confirm the disabled profile cannot intercept this request.');
  assert.equal(disabled.language?.text, 'base response');
  assert.equal(adapterCalls, 2);
  await runtime.stop();

  console.log('P25_ADAPTIVE_SYNAPTIC_MATRIX_RUNTIME=PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
