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
  maximumUncertainty01: 0.68,
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
  assert.throws(() => matrix.registerCandidate(candidate({ maximumContextTokens: 4096 })),
    /id-collision/i,
    'an adapter ID cannot be silently rebound to a different capability profile');
  assert.throws(() => matrix.registerCandidate(candidate({ maximumUncertainty01: '0.68' })),
    /uncertainty/i,
    'adapter profile limits must use typed numeric evidence');
  assert.throws(() => matrix.registerCandidate(candidate({ competenceByTask01: { language: '0.9', reasoning: 0.94 } })),
    /competence/i,
    'task competence cannot be coerced from a string');

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
  assert.equal(matrix.select(request({ uncertainty01: 0.90 })).mode, 'base-fallback',
    'high organism uncertainty must bypass a specialized adapter');
  assert.equal(matrix.select(request({ confidence01: '0.86' })).reason, 'routing-signal-invalid',
    'string-coerced confidence must not bypass numeric routing gates');
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

  const malformedMetric = manifest(candidate(), {
    validation: { ...manifest().validation, adapterScore01: '0.99' },
  });
  assert.throws(() => matrix.activateValidated(malformedMetric, () => true),
    /score/i,
    'numeric strings cannot be used as signed evaluation evidence');

  const malformedDigest = manifest(candidate(), {
    validation: { ...manifest().validation, reportSha256: 'g'.repeat(64) },
  });
  assert.throws(() => matrix.activateValidated(malformedDigest, () => true),
    /report/i,
    'non-hex report digests must be rejected before signature verification');

  assert.throws(() => matrix.activateValidated(manifest(), () => {
    throw new Error('trusted-keystore-unavailable');
  }), /signature|verification/i,
  'a verifier failure must fail closed rather than activating the adapter');
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
  const strongestPhysics = candidate({
    competenceByTask01: { language: 0.94, reasoning: 0.94 },
  });
  const interposedBiology = candidate({
    id: 'biology-lora-v1',
    artifactRef: 'file:adapters/biology-lora-v1.safetensors',
    artifactSha256: hash('e'),
    conflictGroup: 'biology-domain',
    competenceByTask01: { language: 0.93, reasoning: 0.93 },
  });
  const thirdPhysics = candidate({
    id: 'physics-lora-v2',
    artifactRef: 'file:adapters/physics-lora-v2.safetensors',
    artifactSha256: hash('f'),
    conflictGroup: 'physics-domain',
    competenceByTask01: { language: 0.92, reasoning: 0.92 },
  });
  matrix.registerCandidate(strongestPhysics);
  matrix.registerCandidate(interposedBiology);
  matrix.registerCandidate(thirdPhysics);
  matrix.activateValidated(manifest(strongestPhysics), () => true);
  matrix.activateValidated(manifest(interposedBiology, {
    validation: {
      ...manifest().validation,
      reportId: 'holdout-biology-2026-11',
      reportSha256: hash('7'),
      holdoutDatasetRef: 'dataset://biology/holdout-v2',
    },
  }), () => true);
  matrix.activateValidated(manifest(thirdPhysics, {
    validation: {
      ...manifest().validation,
      reportId: 'holdout-physics-v2-2026-11',
      reportSha256: hash('8'),
      holdoutDatasetRef: 'dataset://physics/holdout-v4',
    },
  }), () => true);
  const interposedAmbiguity = matrix.select(request());
  assert.equal(interposedAmbiguity.mode, 'base-fallback',
    'a cross-group adapter between same-group competitors must not hide their ambiguity');
  assert.equal(interposedAmbiguity.reason, 'ambiguous-adapter-competition');
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

  const rejectedRestore = new AdaptiveSynapticMatrixEngine();
  rejectedRestore.restore(snapshot, () => false);
  assert.equal(rejectedRestore.snapshot().adapters[0].status, 'quarantined',
    'a failed signature verification on restore must quarantine the adapter');

  const cooldownRecovery = new AdaptiveSynapticMatrixEngine();
  cooldownRecovery.registerCandidate(candidate());
  cooldownRecovery.activateValidated(manifest(), () => true);
  cooldownRecovery.observe('physics-lora-v1', false, 100, 900);
  cooldownRecovery.observe('physics-lora-v1', false, 100, 1100);
  assert.equal(cooldownRecovery.select(request(), 1100).mode, 'base-fallback');
  assert.equal(cooldownRecovery.select(request(), 61_100).mode, 'adapter',
    'a temporary failure must be recoverable after the bounded cooldown');

  const explicitlyDisabled = new AdaptiveSynapticMatrixEngine();
  explicitlyDisabled.registerCandidate(candidate());
  explicitlyDisabled.activateValidated(manifest(), () => true);
  explicitlyDisabled.disable('physics-lora-v1');
  assert.equal(explicitlyDisabled.select(request()).mode, 'base-fallback');
  explicitlyDisabled.activateValidated(manifest(), () => true);
  assert.equal(explicitlyDisabled.select(request()).mode, 'adapter',
    'an operator may explicitly reactivate a disabled profile using a fresh verified activation');

  const repeatedFailure = new AdaptiveSynapticMatrixEngine();
  repeatedFailure.registerCandidate(candidate());
  repeatedFailure.activateValidated(manifest(), () => true);
  for (let i = 0; i < 6; i += 1) repeatedFailure.observe('physics-lora-v1', false, 100, 10_000 + i * 1_000);
  assert.equal(repeatedFailure.snapshot().adapters[0].status, 'quarantined',
    'a specialist that repeatedly fails across cooldown windows must be quarantined');
  assert.throws(() => repeatedFailure.activateValidated(manifest(), () => true),
    /revalidation/i,
    'quarantine cannot be cleared by replaying the same stale evaluation report');
  const freshManifest = manifest(candidate(), {
    validation: {
      ...manifest().validation,
      reportId: 'holdout-physics-revalidated-2026-11',
      reportSha256: hash('d'),
      holdoutDatasetRef: 'dataset://physics/holdout-v3',
    },
  });
  const restoredQuarantine = new AdaptiveSynapticMatrixEngine();
  restoredQuarantine.restore(repeatedFailure.snapshot(), () => true);
  assert.equal(restoredQuarantine.snapshot().adapters[0].status, 'quarantined',
    'quarantine must survive restart and must never become an active profile during restore');
  assert.throws(() => restoredQuarantine.activateValidated(manifest(), () => true),
    /revalidation/i,
    'the last accepted holdout digest must survive restart to prevent stale-report replay');

  const administrativelyDisabledQuarantine = new AdaptiveSynapticMatrixEngine();
  administrativelyDisabledQuarantine.restore(repeatedFailure.snapshot(), () => true);
  assert.equal(administrativelyDisabledQuarantine.disable('physics-lora-v1')?.status, 'disabled');
  const restoredDisabledQuarantine = new AdaptiveSynapticMatrixEngine();
  restoredDisabledQuarantine.restore(administrativelyDisabledQuarantine.snapshot(), () => true);
  assert.equal(restoredDisabledQuarantine.snapshot().adapters[0].status, 'disabled');
  assert.throws(() => restoredDisabledQuarantine.activateValidated(manifest(), () => true),
    /revalidation/i,
    'manual disable and another restart must not clear quarantine anti-replay protection');
  assert.equal(restoredQuarantine.activateValidated(freshManifest, () => true).status, 'active',
    'a fresh signed holdout report may reactivate the quarantined adapter after restart');
  assert.equal(repeatedFailure.activateValidated(freshManifest, () => true).status, 'active',
    'a new signed holdout report can explicitly revalidate a quarantined specialist');
}

console.log('P25_ADAPTIVE_SYNAPTIC_MATRIX=PASS');
