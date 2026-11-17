import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import {
  HyperPlasticNetwork,
  hyperPlasticContextFromB292,
} from '../src/organism/research/HyperPlasticNetwork.ts';
import {
  evaluateHyperPlasticSignedPromotion,
  hyperPlasticMethodIdentity,
  isTrustedHyperPlasticPromotionPermit,
  measureHyperPlasticSignedSplit,
} from '../src/organism/research/HyperPlasticOutcomeEvaluator.ts';
import { resolveHyperPlasticAdapterRoute } from '../src/server/local-language-backend-policy.mjs';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const verifierId = 'ome26-independent-signed-verifier';
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = new Map([[verifierId, publicPem]]);
const baseModelFingerprint = `sha256:${createHash('sha256').update('ome26-test-base-model').digest('hex')}`;

const bus = new B292CognitiveStateBus();
bus.restore(defaultB292CognitiveStateBus());
const context = hyperPlasticContextFromB292(bus.snapshot(), {
  taskType: 'reasoning', strategy: 'verify', confidence01: 0.9, resourceBudget01: 0.9,
});
const network = new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 }, rank: 2, hiddenDim: 12, seed: 26026,
});
const generated = network.generateCandidate(context, baseModelFingerprint, 1);
assert.equal(generated.status, 'candidate');
const adapter = generated.adapter;
const baselineMethod = hyperPlasticMethodIdentity('baseline', baseModelFingerprint);
const adapterMethod = hyperPlasticMethodIdentity('adapter', baseModelFingerprint, adapter.fingerprint);

const manifest = [];
for (const split of ['validation', 'holdout']) {
  for (let task = 0; task < 2; task++) {
    manifest.push({
      taskId: `ome26-${split}-task-${task}`, family: 'reasoning', split,
      promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`OME26 ${split} reasoning task ${task} unique signed prompt`),
      verifierId, version: 'v1',
    });
  }
}
const ledger = new VerifiedOutcomeLedger(manifest);
let acceptedArtifacts = 0;
function signRow(targetLedger, task, method, seed, passed, durationMs, safetyRegressionCount = 0) {
  const payload = {
    schemaVersion: 1,
    artifactId: `ome26-${task.taskId}-${method}-${seed}`,
    runId: `ome26-run-${method}-${seed}`,
    manifestFingerprint: targetLedger.manifestFingerprint(),
    taskId: task.taskId, taskVersion: task.version, method, seed, attempt: 1,
    passed, verifierId, observedAt: 1_800_000_000_000 + seed,
    metrics: { durationMs, safetyRegressionCount, peakMemoryBytes: 64 * 1024 * 1024, promptTokens: 128, completionTokens: 64 },
  };
  const result = ingestSignedOutcomeArtifact(
    targetLedger, manifest, signOutcomePayloadForFixture(payload, privatePem), trustedKeys,
  );
  assert.equal(result.accepted, true, result.rejection ?? 'signed evidence should ingest');
  acceptedArtifacts++;
}
for (const seed of [11, 22, 33, 44, 55]) {
  for (const task of manifest) {
    const baselinePassed = task.taskId.endsWith('-task-0');
    signRow(ledger, task, baselineMethod, seed, baselinePassed, 100);
    signRow(ledger, task, adapterMethod, seed, true, 110);
  }
}
assert.equal(acceptedArtifacts, 40);
assert.equal(ledger.snapshot().acceptedOutcomes, 40);

const config = { ledger, manifest, adapter, baseModelFingerprint, taskFamily: 'reasoning', minimumPairedSeeds: 5 };
const validation = measureHyperPlasticSignedSplit('validation', config);
const holdout = measureHyperPlasticSignedSplit('holdout', config);
assert.ok(validation, 'signed validation evidence should produce a seed-paired measurement');
assert.ok(holdout, 'signed holdout evidence should produce a seed-paired measurement');
assert.equal(validation.pairedSeedCount, 5);
assert.equal(holdout.pairedSeedCount, 5);
assert.equal(validation.meanGain01, 0.5);
assert.equal(holdout.meanGain01, 0.5);
assert.equal(holdout.meanLatencyOverhead01, 0.1);
assert.ok(holdout.lowerConfidenceBound95OneSided01 > 0);
assert.notEqual(validation.splitFingerprint, holdout.splitFingerprint);

const promoted = evaluateHyperPlasticSignedPromotion(config);
assert.equal(promoted.eligible, true, JSON.stringify(promoted.reasons));
assert.equal(promoted.holdout.pairedSeedCount, 5);
assert.equal(isTrustedHyperPlasticPromotionPermit(promoted.permit, {
  adapterFingerprint: adapter.fingerprint, baseModelFingerprint,
}), true);

const route = resolveHyperPlasticAdapterRoute({
  backendCapabilities: { supportsLowRankAdapters: true, supportedLowRankTargets: ['attention.query'] },
  baseModelFingerprint, adapter, promotionPermit: promoted.permit,
});
assert.equal(route.mode, 'adapter');
assert.equal(route.reason, 'holdout-qualified');

const copiedPermit = structuredClone(promoted.permit);
assert.equal(isTrustedHyperPlasticPromotionPermit(copiedPermit, {
  adapterFingerprint: adapter.fingerprint, baseModelFingerprint,
}), false);
assert.equal(resolveHyperPlasticAdapterRoute({
  backendCapabilities: { supportsLowRankAdapters: true, supportedLowRankTargets: ['attention.query'] },
  baseModelFingerprint, adapter, promotionPermit: copiedPermit,
}).mode, 'baseline');

const restored = VerifiedOutcomeLedger.restoreSnapshot(ledger.snapshot());
assert.equal(evaluateHyperPlasticSignedPromotion({ ...config, ledger: restored }).eligible, false,
  'persisted outcome rows without re-authenticated Ed25519 receipts must never qualify');

const badLatencyLedger = new VerifiedOutcomeLedger(manifest);
for (const seed of [11, 22, 33, 44, 55]) {
  for (const task of manifest) {
    const baselinePassed = task.taskId.endsWith('-task-0');
    assert.equal(signRow(badLatencyLedger, task, baselineMethod, seed, baselinePassed, 100), undefined);
    assert.equal(signRow(badLatencyLedger, task, adapterMethod, seed, true, 125), undefined);
  }
}
const badLatency = evaluateHyperPlasticSignedPromotion({ ...config, ledger: badLatencyLedger });
assert.equal(badLatency.eligible, false);
assert.deepEqual(badLatency.reasons, ['holdout-latency-overhead-exceeds-limit']);

const badSafetyLedger = new VerifiedOutcomeLedger(manifest);
for (const seed of [11, 22, 33, 44, 55]) {
  for (const task of manifest) {
    const baselinePassed = task.taskId.endsWith('-task-0');
    signRow(badSafetyLedger, task, baselineMethod, seed, baselinePassed, 100, 0);
    signRow(badSafetyLedger, task, adapterMethod, seed, true, 110,
      task.split === 'holdout' && seed === 33 ? 1 : 0);
  }
}
const badSafety = evaluateHyperPlasticSignedPromotion({ ...config, ledger: badSafetyLedger });
assert.equal(badSafety.eligible, false);
assert.deepEqual(badSafety.reasons, ['holdout-safety-regression']);

const insufficient = evaluateHyperPlasticSignedPromotion({ ...config, minimumPairedSeeds: 6 });
assert.equal(insufficient.eligible, false);

console.log('OME26_SIGNED_PROMOTION=PASS', JSON.stringify({
  signedArtifacts: ledger.snapshot().acceptedOutcomes,
  validationSeeds: validation.pairedSeedCount,
  holdoutSeeds: holdout.pairedSeedCount,
  holdoutGain01: holdout.meanGain01,
  holdoutLowerBound95: holdout.lowerConfidenceBound95OneSided01,
  latencyOverhead01: holdout.meanLatencyOverhead01,
  restoredReceiptRejected: true,
  rawCallerScoresRejected: true,
}));
