import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { ExperimentCampaignRegistry } from '../src/organism/learning/ExperimentCampaignRegistry.ts';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const manifest = ['memory', 'transfer', 'tool-use'].map(family => ({
  taskId: `task-${family}`,
  family,
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`NK1 confirmatory holdout task: ${family}`),
  verifierId: 'independent-oracle-v1',
  version: '1',
}));
const options = {
  split: 'holdout',
  seeds: Array.from({ length: 12 }, (_, i) => i + 1),
  resetEvery: [1],
  priorMethod: 'baseline-v1',
  continuousMethod: 'candidate-a',
  resetMethodPrefix: 'candidate-b-',
};
const plan = createLearningExperimentPlan(manifest, options);
const baselineFingerprint = hash('baseline model config v1');
const candidateFingerprints = {
  'candidate-a': hash('candidate A model config v1'),
  'candidate-b-1': hash('candidate B model config v1'),
};
const policy = {
  minIndependentSeeds: 12,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
  familyPairCountMode: 'seed-repeated',
  familyWiseAlpha: 0.05,
};
const input = {
  campaignId: 'nk1-memory-eval-2026-01',
  plan,
  manifest,
  baselineMethod: 'baseline-v1',
  baselineFingerprint,
  candidateFingerprints,
  primaryMetric: 'task-pass-rate',
  promotionPolicy: policy,
  registeredAt: 1_800_000_000_000,
};
const registry = new ExperimentCampaignRegistry();
const registration = registry.register(input);
assert.equal(registration.split, 'holdout');
assert.equal(registration.planFingerprint, plan.planFingerprint);
assert.equal(registration.candidates.length, 2);
assert.equal(registry.register(input).registrationFingerprint, registration.registrationFingerprint,
  'exact preregistration retry is idempotent');
assert.throws(() => registry.register({
  ...input,
  campaignId: 'nk1-memory-eval-2026-invalid',
  primaryMetric: 'latency-p95',
}), /invalid experiment campaign registration/,
  'a preregistered metric must be implemented by the current ledger evaluator');
assert.throws(() => registry.register({
  ...input,
  campaignId: 'nk1-memory-eval-2026-invalid2',
  candidateFingerprints: { ...candidateFingerprints, 'candidate-a': 123 },
}), /candidate fingerprints must cover/,
  'candidate fingerprints must be actual SHA-256 strings, not coerced values');
assert.throws(() => registry.register({
  ...input,
  candidateFingerprints: { ...candidateFingerprints, 'candidate-a': hash('tampered candidate config') },
}), /different registration/);
assert.throws(() => registry.register({ ...input, campaignId: 'nk1-memory-eval-2026-02' }),
  /already reserved/);

const manifestWithNewTrainingRow = [
  ...manifest,
  {
    taskId: 'training-only',
    family: 'memory',
    split: 'train',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('new training prompt does not change holdout identity'),
    verifierId: 'independent-oracle-v1',
    version: '1',
  },
];
const planWithNewTrainingRow = createLearningExperimentPlan(manifestWithNewTrainingRow, options);
assert.notEqual(planWithNewTrainingRow.manifestFingerprint, plan.manifestFingerprint);
assert.equal(
  new VerifiedOutcomeLedger(manifestWithNewTrainingRow).splitManifestFingerprint('holdout'),
  new VerifiedOutcomeLedger(manifest).splitManifestFingerprint('holdout'),
  'holdout digest is independent of changes to unrelated train rows',
);
assert.throws(() => registry.register({
  ...input, campaignId: 'nk1-memory-eval-2026-03',
  manifest: manifestWithNewTrainingRow, plan: planWithNewTrainingRow,
}), /already reserved/);

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = new Map([['independent-oracle-v1', publicPem]]);

const untrustedLedger = new VerifiedOutcomeLedger(manifest);
for (const run of plan.runs) {
  const passed = run.method === 'candidate-a'
    ? true
    : run.seed % 3 === 0;
  const result = untrustedLedger.record({
    taskId: run.taskId, taskVersion: run.taskVersion, method: run.method,
    seed: run.seed, attempt: 1, passed,
    authority: 'independent-verifier', verifierId: run.verifierId,
    evidenceRef: `caller-claim://${run.runId}`, observedAt: 1_800_000_000_000 + run.orderWithinSeed + run.seed,
  });
  assert.equal(result.accepted, true);
}
assert.throws(() => registry.evaluate(input.campaignId, plan, untrustedLedger), /authenticated signed artifact/);
assert.equal(registry.get(input.campaignId).status, 'registered',
  'a failed evidence authentication attempt must not finalize or spend the campaign');

const ledger = new VerifiedOutcomeLedger(manifest);
let observedAt = 1_800_000_000_000;
for (const run of plan.runs) {
  const baselinePassed = run.seed % 3 === 0;
  const passed = run.method === 'candidate-a' ? true : baselinePassed;
  const fingerprint = run.method === 'baseline-v1'
    ? baselineFingerprint
    : candidateFingerprints[run.method];
  const payload = {
    schemaVersion: 1,
    artifactId: `artifact-${run.runId}`,
    runId: run.runId,
    manifestFingerprint: plan.manifestFingerprint,
    taskId: run.taskId,
    taskVersion: run.taskVersion,
    method: run.method,
    methodFingerprint: fingerprint,
    seed: run.seed,
    attempt: 1,
    passed,
    verifierId: run.verifierId,
    observedAt: observedAt++,
  };
  const signed = signOutcomePayloadForFixture(payload, privatePem);
  const accepted = ingestSignedOutcomeArtifact(ledger, manifest, signed, trustedKeys);
  assert.equal(accepted.accepted, true, accepted.rejection);
}
assert.equal(ledger.snapshot().acceptedOutcomes, plan.counts.runs);

const result = registry.evaluate(input.campaignId, plan, ledger);
assert.equal(registry.get(input.campaignId).status, 'finalized');
assert.equal(result.hypotheses, 2);
assert.deepEqual(result.eligibleMethods, ['candidate-a']);
const candidateA = result.results.find(row => row.method === 'candidate-a');
const candidateB = result.results.find(row => row.method === 'candidate-b-1');
assert.equal(candidateA.eligible, true, JSON.stringify(candidateA));
assert.equal(candidateA.adjustedPValue, 2 * candidateA.rawPValue);
assert.equal(candidateB.eligible, false);
assert.ok(candidateB.reasons.includes('primary-sign-test-not-significant'));
assert.equal(candidateA.gate.statisticalEvidence.unit, 'seed');
assert.ok(candidateA.gate.aggregateGain > 0.6);
assert.ok(candidateA.gate.familyResults.every(row => row.pairedN === 12));

const snapshot = registry.snapshot();
const restored = ExperimentCampaignRegistry.restoreSnapshot(JSON.parse(JSON.stringify(snapshot)));
assert.deepEqual(restored.get(input.campaignId), registry.get(input.campaignId));
assert.deepEqual(restored.evaluate(input.campaignId, plan, ledger), result,
  'same authenticated evidence returns the frozen result after restore');
assert.throws(() => restored.register({ ...input, campaignId: 'nk1-memory-eval-2026-04' }), /already reserved/);
assert.throws(() => ExperimentCampaignRegistry.restoreSnapshot({
  ...snapshot,
  campaigns: snapshot.campaigns.map(row => ({ ...row, status: 'registered' })),
}), /fingerprint mismatch/);

// A second look or a retry against a finalized holdout campaign is rejected.
const extra = ledger.record({
  taskId: plan.runs[0].taskId,
  taskVersion: plan.runs[0].taskVersion,
  method: plan.runs[0].method,
  seed: plan.runs[0].seed,
  attempt: 2,
  passed: !ledger.snapshot().outcomes.find(row =>
    row.taskId === plan.runs[0].taskId && row.method === plan.runs[0].method && row.seed === plan.runs[0].seed
  ).passed,
  authority: 'independent-verifier',
  verifierId: plan.runs[0].verifierId,
  evidenceRef: 'unsigned-retry://should-never-be-used',
  observedAt: observedAt + 1,
});
assert.equal(extra.accepted, true);
assert.throws(() => restored.evaluate(input.campaignId, plan, ledger), /unplanned seed or retry attempt/);

console.log('P23_EXPERIMENT_CAMPAIGN_REGISTRY=PASS', JSON.stringify({
  planRuns: plan.counts.runs,
  candidates: result.results.map(row => ({
    method: row.method,
    eligible: row.eligible,
    rawP: row.rawPValue,
    adjustedP: row.adjustedPValue,
  })),
  holdoutManifestLocked: true,
  signedOutcomesRequired: true,
  finalizedOnce: true,
}));
