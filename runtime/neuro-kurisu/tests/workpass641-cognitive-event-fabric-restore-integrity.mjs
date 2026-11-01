import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const source = new CognitiveEventFabric();
source.append({ id: 'obs:1', tick: 1, at: 100, stage: 'observation', source: 'fixture', payload: { label: 'safe' } });
const valid = source.snapshot();
const validRestore = new CognitiveEventFabric();
validRestore.restore(valid);
assert.equal(validRestore.recent(1)[0]?.at, 100);
assert.equal(validRestore.recent(1)[0]?.payload.label, 'safe');

let getterCalls = 0;
const hostileEvent = {
  id: 'hostile:1',
  tick: 2,
  stage: 'observation',
  parentIds: [],
  external: 'true',
  confidence01: '0.99',
  payload: {},
};
Object.defineProperty(hostileEvent, 'at', { enumerable: true, get() { getterCalls++; return 999; } });
Object.defineProperty(hostileEvent, 'source', { enumerable: true, get() { getterCalls++; return 'getter-source'; } });
Object.defineProperty(hostileEvent.payload, 'secret', { enumerable: true, get() { getterCalls++; return 'getter-value'; } });
const accessorRow = {};
Object.defineProperty(accessorRow, 'id', { enumerable: true, get() { getterCalls++; return 'accessor:1'; } });
Object.assign(accessorRow, { tick: 3, stage: 'observation', parentIds: [] });
const accessorArray = [];
Object.defineProperty(accessorArray, '0', { enumerable: true, get() { getterCalls++; return hostileEvent; } });
accessorArray.length = 1;
const hostileSnapshot = { receiptEvents: [], total: '100', receiptProjectionIndex: [] };
Object.defineProperty(hostileSnapshot, 'recent', { enumerable: true, get() { getterCalls++; return [hostileEvent]; } });
const safe = new CognitiveEventFabric();
safe.restore(hostileSnapshot);
assert.equal(getterCalls, 0, 'snapshot restore must never execute root/row/array/payload getters');
assert.equal(safe.snapshot().total, 0, 'numeric-string totals must not become trusted counters');
assert.equal(safe.recent(1).length, 0, 'accessor-backed recent arrays must be ignored');

const coercionSnapshot = {
  total: 12,
  recent: [
    hostileEvent,
    { id: 'numeric-tick', tick: '4', stage: 'observation', at: 123, parentIds: [], source: 'fixture' },
  ],
  receiptEvents: [],
  receiptProjectionIndex: [],
};
const coercionSafe = new CognitiveEventFabric();
coercionSafe.restore(coercionSnapshot);
const restored = coercionSafe.recent(4);
assert.equal(restored.length, 1, 'numeric-string ticks must be rejected');
assert.equal(restored[0].at, 0, 'numeric-string timestamps must use the conservative fallback');
assert.equal(restored[0].external, false, 'string booleans must not be truth-coerced');
assert.equal(restored[0].confidence01, 0.5, 'numeric-string confidence must not be trusted');
assert.equal(restored[0].source, 'restored-unknown', 'accessor-backed source must be ignored');
assert.deepEqual(restored[0].payload, {}, 'accessor-backed payload fields must be omitted');

const receiptSource = new CognitiveEventFabric();
receiptSource.appendToolReceiptTrace({
  tick: 7, executionId: 'exec:7', toolId: 'test-tool', ok: true, verified: true,
  outcomeClass: 'success', confidence01: 0.9, verificationBasis: 'external-receipt',
  externalObservation: false, observationIntegrated: false,
});
const tamperedReceipt = receiptSource.snapshot();
assert.equal(tamperedReceipt.receiptProjectionIndex?.length, 1);
tamperedReceipt.receiptProjectionIndex[0].projectedAt = '1700000000000';
const receiptRestore = new CognitiveEventFabric();
receiptRestore.restore(tamperedReceipt);
assert.equal(receiptRestore.hasToolReceiptTrace('exec:7'), false,
  'a receipt replay guard with a numeric-string timestamp must not be restored');

console.log('COGNITIVE_EVENT_FABRIC_SNAPSHOT_RESTORE=PASS');
