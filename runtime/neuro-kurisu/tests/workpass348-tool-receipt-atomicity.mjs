import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const receipt = (overrides = {}) => ({
  tick: 8,
  executionId: 'exec:workpass348:atomic',
  toolId: 'organism.inspect',
  decisionId: 'decision:possibly-outside-window',
  ok: true,
  verified: true,
  outcomeClass: 'executed-verified',
  confidence01: 0.91,
  verificationBasis: 'tool-contract',
  externalObservation: false,
  observationIntegrated: false,
  at: 1700000000000,
  ...overrides,
});

const fabric = new CognitiveEventFabric(128);
const first = fabric.appendToolReceiptTrace(receipt());
assert.equal(first.replayed, false);
assert.equal(fabric.snapshot().total, 3);
assert.equal(fabric.snapshot().receiptProjectionIndex.length, 1);
assert.equal(fabric.appendToolReceiptTrace(receipt()).replayed, true);
const baseline = fabric.snapshot();

const invalidReplays = [
  [{ tick: 8.5 }, /invalid-cognitive-event-tick/],
  [{ tick: Number.NaN }, /invalid-cognitive-event-tick/],
  [{ at: -1 }, /invalid-cognitive-event-timestamp/],
  [{ ok: 'false' }, /invalid-tool-receipt-boolean/],
  [{ verified: 1 }, /invalid-tool-receipt-boolean/],
  [{ externalObservation: 'false' }, /invalid-tool-receipt-boolean/],
  [{ observationIntegrated: 0 }, /invalid-tool-receipt-boolean/],
  [{ confidence01: Number.NaN }, /invalid-cognitive-event-confidence/],
  [{ toolId: { toString() { throw new Error('untrusted coercion must not run'); } } }, /invalid-tool-receipt-tool-id/],
  [{ decisionId: { toString() { throw new Error('untrusted coercion must not run'); } } }, /invalid-tool-receipt-decision-id/],
];
for (const [change, expectedError] of invalidReplays) {
  assert.throws(() => fabric.appendToolReceiptTrace(receipt(change)), expectedError);
  assert.equal(fabric.snapshot().total, baseline.total);
  assert.equal(fabric.snapshot().receiptProjectionIndex.length, baseline.receiptProjectionIndex.length);
  assert.deepEqual(fabric.snapshot().recent.map(event => event.id), baseline.recent.map(event => event.id));
}

const interrupted = new CognitiveEventFabric(128);
const realAppend = interrupted.append.bind(interrupted);
let appendCalls = 0;
interrupted.append = function(input) {
  appendCalls += 1;
  if (appendCalls === 3) throw new Error('injected-tool-receipt-third-append-failure');
  return realAppend(input);
};
assert.throws(
  () => interrupted.appendToolReceiptTrace(receipt({ executionId: 'exec:workpass348:rollback' })),
  /injected-tool-receipt-third-append-failure/,
);
assert.equal(appendCalls, 3);
assert.equal(interrupted.snapshot().total, 0);
assert.equal(interrupted.snapshot().recent.length, 0);
assert.equal(interrupted.snapshot().receiptProjectionIndex.length, 0);

interrupted.append = realAppend;
const retried = interrupted.appendToolReceiptTrace(receipt({ executionId: 'exec:workpass348:rollback' }));
assert.equal(retried.replayed, false);
assert.equal(interrupted.snapshot().total, 3);
assert.equal(interrupted.snapshot().receiptProjectionIndex.length, 1);

console.log('WorkPass348 receipt trace atomicity: PASS');
