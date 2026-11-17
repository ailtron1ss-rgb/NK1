import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const verifierId = 'ome26-signed-metrics-verifier';
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const manifest = [{
  taskId: 'ome26-signed-metrics-task',
  family: 'reasoning',
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('OME26 metrics preservation regression prompt'),
  verifierId,
  version: 'v1',
}];
const trustedKeys = new Map([[verifierId, publicPem]]);
const ledger = new VerifiedOutcomeLedger(manifest);

function signedPayload(artifactId, metrics) {
  return {
    schemaVersion: 1,
    artifactId,
    runId: 'ome26-signed-metrics-run',
    manifestFingerprint: ledger.manifestFingerprint(),
    taskId: manifest[0].taskId,
    taskVersion: 'v1',
    method: 'baseline',
    seed: 17,
    attempt: 1,
    passed: true,
    verifierId,
    observedAt: 1_800_000_000_000,
    metrics,
  };
}

const metrics = {
  durationMs: 137.5,
  safetyRegressionCount: 0,
  peakMemoryBytes: 67_108_864,
  promptTokens: 512,
  completionTokens: 96,
};
const accepted = ingestSignedOutcomeArtifact(
  ledger,
  manifest,
  signOutcomePayloadForFixture(signedPayload('ome26-valid-metrics', metrics), privatePem),
  trustedKeys,
);
assert.equal(accepted.accepted, true);
assert.deepEqual(
  ledger.snapshot().outcomes[0].metrics,
  metrics,
  'authenticated execution metrics must survive ingestion and ledger storage',
);

const malformedMetrics = {
  durationMs: -1,
  safetyRegressionCount: 0,
};
const malformedLedger = new VerifiedOutcomeLedger(manifest);
const malformed = ingestSignedOutcomeArtifact(
  malformedLedger,
  manifest,
  signOutcomePayloadForFixture(signedPayload('ome26-invalid-duration', malformedMetrics), privatePem),
  trustedKeys,
);
assert.equal(malformed.accepted, false,
  'a signed artifact with an invalid duration must not become authenticated evidence');
assert.equal(malformedLedger.snapshot().acceptedOutcomes, 0);

const unknownMetricLedger = new VerifiedOutcomeLedger(manifest);
const unknownMetric = ingestSignedOutcomeArtifact(
  unknownMetricLedger,
  manifest,
  signOutcomePayloadForFixture(signedPayload('ome26-unknown-metric', {
    durationMs: 137,
    safetyRegressionCount: 0,
    trusted: true,
  }), privatePem),
  trustedKeys,
);
assert.equal(unknownMetric.accepted, false,
  'unknown metric fields must not be silently treated as verified telemetry');
assert.equal(unknownMetricLedger.snapshot().acceptedOutcomes, 0);

const restored = VerifiedOutcomeLedger.restoreSnapshot(ledger.snapshot());
assert.deepEqual(restored.snapshot().outcomes[0].metrics, metrics,
  'validated metric data should survive plain snapshot round-trip as data');
console.log('OME26_SIGNED_OUTCOME_METRICS=PASS', JSON.stringify({metrics, authenticatedReceiptRestoresSeparately: true}));
