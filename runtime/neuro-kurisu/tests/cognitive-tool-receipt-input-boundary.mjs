import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const receipt = (overrides = {}) => ({
  tick: 1,
  executionId: 'exec:strict-receipt-input',
  toolId: 'device.set-state',
  decisionId: 'decision:strict-receipt-input',
  ok: true,
  verified: true,
  outcomeClass: 'executed-verified',
  confidence01: 0.9,
  verificationBasis: 'independent-postcondition',
  externalObservation: true,
  observationId: 'observation:strict-receipt-input',
  expectedPostcondition: 'relay=on',
  observedPostcondition: 'relay=on',
  observationIntegrated: true,
  at: 1000,
  ...overrides,
});

const revision = (overrides = {}) => ({
  tick: 2,
  executionId: 'exec:strict-revision-input',
  toolId: 'device.set-state',
  revisionId: 'revision:strict-revision-input',
  revisionNumber: 1,
  providerReceiptHash: 'a'.repeat(64),
  revisionFingerprint: 'b'.repeat(64),
  outcomeClass: 'executed-verified',
  ok: true,
  verified: true,
  verificationBasis: 'external-postcondition',
  confidence01: 0.94,
  observationId: 'provider-observation:strict-input',
  status: 'verified',
  reason: 'provider confirmed',
  at: 2000,
  ...overrides,
});

const observation = (overrides = {}) => ({
  tick: 3,
  executionId: 'exec:strict-observation-input',
  toolId: 'device.observe',
  observationId: 'observation:strict-input',
  verified: true,
  confidence01: 0.92,
  sourceId: 'sensor:front',
  sourceClass: 'camera',
  channel: 'visual',
  independenceKey: 'source:camera-front',
  expectedPostcondition: 'marker is visible',
  observedPostcondition: 'marker is visible',
  reason: 'independent sensor check',
  at: 3000,
  ...overrides,
});

const assertUnchanged = (fabric, before, label) => {
  assert.deepEqual(fabric.snapshot(), before, label);
};

const makeAccessor = (value, key, getter) => {
  const result = { ...value };
  Object.defineProperty(result, key, {
    enumerable: true,
    configurable: true,
    get: getter,
  });
  return result;
};

// Tool-receipt trace: malformed identity, confidence and accessor-backed inputs
// are rejected before replay lookup or event/projection-index mutation.
{
  const fabric = new CognitiveEventFabric(128);
  fabric.appendToolReceiptTrace(receipt());
  const baseline = fabric.snapshot();
  let getterCalls = 0;

  const accessorInput = makeAccessor(receipt({ executionId: 'exec:strict-receipt-input:other' }), 'executionId', () => {
    getterCalls += 1;
    return 'exec:strict-receipt-input:other';
  });
  assert.throws(() => fabric.appendToolReceiptTrace(accessorInput), /invalid-tool-receipt-input/);
  assert.equal(getterCalls, 0, 'trace ingress must not execute top-level getters');
  assertUnchanged(fabric, baseline, 'accessor-backed trace input must not mutate the ledger');

  const coercionCalls = { count: 0 };
  const badInputs = [
    [receipt({ executionId: ' exec:strict-receipt-input ' }), /invalid-tool-receipt-execution-id/],
    [receipt({ executionId: 'x'.repeat(181) }), /invalid-tool-receipt-execution-id/],
    [receipt({ toolId: 'device.set-state ' }), /invalid-tool-receipt-tool-id/],
    [receipt({ decisionId: ' decision:strict-receipt-input' }), /invalid-tool-receipt-decision-id/],
    [receipt({ confidence01: 1.01 }), /invalid-cognitive-event-confidence/],
    [receipt({ confidence01: -0.01 }), /invalid-cognitive-event-confidence/],
    [receipt({ verified: 'false' }), /invalid-tool-receipt-boolean/],
  ];
  for (const [input, expected] of badInputs) {
    assert.throws(() => fabric.appendToolReceiptTrace(input), expected);
    assertUnchanged(fabric, baseline, 'rejected trace input must leave events and replay index unchanged');
  }

  const nonCoercible = { toString() { coercionCalls.count += 1; throw new Error('coercion must not run'); } };
  assert.throws(() => fabric.appendToolReceiptTrace(receipt({ toolId: nonCoercible })), /invalid-tool-receipt-tool-id/);
  assert.equal(coercionCalls.count, 0, 'invalid tool identifiers must not be string-coerced');
  assertUnchanged(fabric, baseline, 'non-string tool identifier must not mutate the ledger');
}

// Provider receipt revision: all identity, hash, number, boolean and confidence fields
// are validated before existing-revision lookup or append-only ledger mutation.
{
  const fabric = new CognitiveEventFabric(128);
  fabric.appendToolReceiptTrace(receipt({ executionId: 'exec:strict-revision-input' }));
  const baseline = fabric.snapshot();
  let getterCalls = 0;
  let coercionCalls = 0;

  const accessorInput = makeAccessor(revision(), 'revisionId', () => {
    getterCalls += 1;
    return 'revision:strict-revision-input';
  });
  const accessorResult = fabric.appendToolReceiptRevision(accessorInput);
  assert.equal(accessorResult.resolved, false);
  assert.equal(accessorResult.reason, 'revision-input-invalid');
  assert.equal(getterCalls, 0, 'revision ingress must not execute top-level getters');
  assertUnchanged(fabric, baseline, 'rejected revision accessor must not mutate the ledger');

  const objectHash = { toString() { coercionCalls += 1; throw new Error('hash coercion must not run'); } };
  const badInputs = [
    revision({ executionId: ' exec:strict-revision-input' }),
    revision({ revisionId: 'revision:strict-revision-input ' }),
    revision({ revisionId: 'r'.repeat(181) }),
    revision({ toolId: 'device.set-state ' }),
    revision({ revisionNumber: 1.5 }),
    revision({ revisionNumber: 0 }),
    revision({ providerReceiptHash: objectHash }),
    revision({ ok: 'false' }),
    revision({ verified: 1 }),
    revision({ confidence01: 1.1 }),
    revision({ confidence01: -0.1 }),
    revision({ at: -1 }),
    revision({ status: 'maybe' }),
  ];
  for (const input of badInputs) {
    const result = fabric.appendToolReceiptRevision(input);
    assert.equal(result.resolved, false, 'invalid revision input must be refused');
    assertUnchanged(fabric, baseline, 'rejected revision must not mutate events or the receipt projection index');
  }
  assert.equal(coercionCalls, 0, 'hashes must be validated as strings, not coerced');

  const accepted = fabric.appendToolReceiptRevision(revision());
  assert.equal(accepted.resolved, true, 'well-formed provider revision remains accepted');
  assert.equal(accepted.replayed, false);
  const afterAccepted = fabric.snapshot();
  const replay = fabric.appendToolReceiptRevision(revision());
  assert.equal(replay.resolved, true);
  assert.equal(replay.replayed, true, 'exact valid revision remains idempotent');
  assert.deepEqual(fabric.snapshot(), afterAccepted, 'valid revision replay must not append duplicate evidence');
}

// External observation: no lossy ID truncation, Boolean coercion or accessor execution.
{
  const fabric = new CognitiveEventFabric(128);
  fabric.appendToolReceiptTrace(receipt({
    executionId: 'exec:strict-observation-input',
    toolId: 'device.observe',
    decisionId: 'decision:strict-observation-input',
  }));
  const accepted = fabric.appendToolExternalObservation(observation());
  assert.equal(accepted.resolved, true);
  const baseline = fabric.snapshot();
  let getterCalls = 0;
  let coercionCalls = 0;

  const accessorInput = makeAccessor(observation({ observationId: 'observation:other' }), 'observationId', () => {
    getterCalls += 1;
    return 'observation:other';
  });
  const accessorResult = fabric.appendToolExternalObservation(accessorInput);
  assert.equal(accessorResult.resolved, false);
  assert.equal(accessorResult.reason, 'observation-input-invalid');
  assert.equal(getterCalls, 0, 'external observation ingress must not execute top-level getters');
  assertUnchanged(fabric, baseline, 'rejected observation accessor must not mutate the ledger');

  const nonCoercible = { toString() { coercionCalls += 1; throw new Error('postcondition coercion must not run'); } };
  const badInputs = [
    observation({ executionId: ' exec:strict-observation-input' }),
    observation({ observationId: 'observation:strict-input ' }),
    observation({ observationId: 'o'.repeat(181) }),
    observation({ toolId: 'device.observe ' }),
    observation({ verified: 'false' }),
    observation({ confidence01: 1.1 }),
    observation({ confidence01: -0.1 }),
    observation({ tick: 3.5 }),
    observation({ at: -1 }),
    observation({ expectedPostcondition: nonCoercible }),
    observation({ sourceId: ' sensor:front' }),
    observation({ independenceKey: 'source:camera-front ' }),
  ];
  for (const input of badInputs) {
    const result = fabric.appendToolExternalObservation(input);
    assert.equal(result.resolved, false, 'invalid external observation input must be refused');
    assertUnchanged(fabric, baseline, 'rejected external observation must not mutate events or replay references');
  }
  assert.equal(coercionCalls, 0, 'non-string evidence text must not be coerced');
}

console.log('Cognitive tool receipt input boundary: PASS');
