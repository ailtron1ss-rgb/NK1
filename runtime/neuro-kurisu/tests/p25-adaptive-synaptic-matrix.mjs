import assert from 'node:assert/strict';
import { AdaptiveSynapticMatrixEngine } from '../src/organism/learning/AdaptiveSynapticMatrix.ts';

const hash = (char) => char.repeat(64);
const candidate = (overrides = {}) => ({
  id: 'physics-lora-v1',
  artifactRef: 'file:adapters/physics-lora-v1.safetensors',
  artifactSha256: hash('a'),
  adapterFormat: 'lora',
  rank: 16,
  baseModelId: 'nk1-local-8b',
  baseModelRevisionSha256: hash('c'),
  tasks: ['language', 'reasoning'],
  competenceByTask01: { language: 0.88, reasoning: 0.94 },
  conflictGroup: 'physics-domain',
  minimumConfidence01: 0.62,
  maximumResourceRisk01: 0.72,
  maximumContextTokens: 8192,
  trainingDatasetRef: 'dataset://physics/train-v3',
  owner: 'neuro-plastic-core',
  ...overrides,
});
const manifest = (entry = candidate(), overrides = {}) => ({
  ...entry,
  validation: {
    reportId: 'holdout-physics-2026-11',
    reportSha256: hash('b'),
    holdoutDatasetRef: 'dataset://physics/holdout-v2',
    pairedSeeds: 10,
    baselineScore01: 0.72,
    adapterScore01: 0.81,
    lower95Delta01: 0.035,
    guardrailRegressionCount: 0,
  },
  signerKeyId: 'nk1-offline-adapter-validator',
  signature: 'trusted-signature',
  ...overrides,
});
const request = (overrides = {}) => ({
  task: 'reasoning',
  baseModelId: 'nk1-local-8b',
  baseModelRevisionSha256: hash('c'),
  contextTokens: 2048,
  confidence01: 0.86,
  uncertainty01: 0.18,
  resourceRisk01: 0.22,
  executorAvailable: true,
  ...overrides,
});

{
  const matrix = new AdaptiveSynapticMatrixEngine();
  matrix.registerCandidate(candidate());

  assert.equal(matrix.select(request()).mode, 'base-fallback',
    'unvalidated candidates must never enter an inference route');
  assert.equal(matrix.select(request({ executorAvailable: false })).reason, 'adapter-executor-unavailable',
    'a profile must not be selected when the host cannot actually apply adapter weights');

  const activated = matrix.activateValidated(
    manifest(),
    (payload, signature, keyId) => payload.includes('"reportId":"holdout-physics-2026-11"')
      && signature === 'trusted-signature'
      && keyId === 'nk1-offline-adapter-validator',
  );
  assert.equal(activated.status, 'active');

  const selected = matrix.select(request());
  assert.equal(selected.mode, 'adapter');
  assert.equal(selected.adapterId, 'physics-lora-v1');
  assert.deepEqual(selected.adapterIds, ['physics-lora-v1'],
    'one adapter at a time prevents unverified composition conflicts');

  assert.equal(matrix.select(request({ baseModelId: 'different-base-model' })).mode, 'base-fallback',
    'adapters must only run on the exact base model identity');
  assert.equal(matrix.select(request({ baseModelRevisionSha256: hash('d') })).mode, 'base-fallback',
    'a changed base-model revision invalidates compatibility');
  assert.equal(matrix.select(request({ confidence01: 0.30 })).mode, 'base-fallback',
    'low-confidence requests must fall back to the base model');
  assert.equal(matrix.select(request({ resourceRisk01: 0.91 })).mode, 'base-fallback',
    'resource pressure above the adapter profile limit must fall back');
  assert.equal(matrix.select(request({ contextTokens: 9000 })).mode, 'base-fallback',
    'requests above an adapter context limit must fall back');
  assert.equal(matrix.select(request({ executorAvailable: false })).mode, 'base-fallback',
    'the router must not advertise an adapter that the host cannot execute');
}

{
  const matrix = new AdaptiveSynapticMatrixEngine();
  matrix.registerCandidate(candidate());
  assert.throws(() => matrix.activateValidated(
    manifest(candidate(), { signature: 'tampered' }),
    () => false,
  ), /signature|verification/i,
  'an invalid manifest signature must prevent activation');

  const invalidHoldout = manifest(candidate(), {
    validation: { ...manifest().validation, holdoutDatasetRef: 'dataset://physics/train-v3' },
  });
  assert.throws(() => matrix.activateValidated(invalidHoldout, () => true),
    /holdout|training/i,
    'a validation report cannot reuse training data as its holdout');

  const tooFewSeeds = manifest(candidate(), {
    validation: { ...manifest().validation, pairedSeeds: 2 },
  });
  assert.throws(() => matrix.activateValidated(tooFewSeeds, () => true),
    /paired|seed/i,
    'a small, underpowered evaluation must not activate an adapter');
}

{
  const matrix = new AdaptiveSynapticMatrixEngine();
  matrix.registerCandidate(candidate());
  matrix.registerCandidate(candidate({
    id: 'mechanics-lora-v1',
    artifactRef: 'file:adapters/mechanics-lora-v1.safetensors',
    artifactSha256: hash('e'),
    competenceByTask01: { language: 0.88, reasoning: 0.94 },
  }));
  matrix.activateValidated(manifest(), () => true);
  matrix.activateValidated(manifest(candidate({
    id: 'mechanics-lora-v1',
    artifactRef: 'file:adapters/mechanics-lora-v1.safetensors',
    artifactSha256: hash('e'),
    competenceByTask01: { language: 0.88, reasoning: 0.94 },
  }), {
    validation: {
      ...manifest().validation,
      reportId: 'holdout-mechanics-2026-11',
      reportSha256: hash('f'),
      holdoutDatasetRef: 'dataset://mechanics/holdout-v2',
    },
  }), () => true);
  const ambiguous = matrix.select(request());
  assert.equal(ambiguous.mode, 'base-fallback');
  assert.equal(ambiguous.reason, 'ambiguous-adapter-competition',
    'near-equal adapters in a shared conflict group must not be arbitrarily combined or picked');
}

{
  const matrix = new AdaptiveSynapticMatrixEngine();
  matrix.registerCandidate(candidate());
  matrix.activateValidated(manifest(), () => true);
  matrix.observe('physics-lora-v1', false, 900);
  matrix.observe('physics-lora-v1', false, 1100);
  assert.equal(matrix.select(request()).mode, 'base-fallback',
    'repeated execution failures must place an adapter in cooldown');
  const snapshot = matrix.snapshot();
  const restored = new AdaptiveSynapticMatrixEngine();
  restored.restore(snapshot, () => true);
  assert.equal(restored.snapshot().adapters[0].status, 'active');

  const untrustedRestore = new AdaptiveSynapticMatrixEngine();
  untrustedRestore.restore(snapshot);
  assert.equal(untrustedRestore.snapshot().adapters[0].status, 'quarantined',
    'persisted activation cannot bypass manifest verification on restore');
}

console.log('P25_ADAPTIVE_SYNAPTIC_MATRIX=PASS');
