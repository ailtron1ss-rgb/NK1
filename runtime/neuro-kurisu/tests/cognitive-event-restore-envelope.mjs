import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const makeRow = (overrides = {}) => ({
  id: 'restore:event:1',
  tick: 1,
  at: 100,
  stage: 'observation',
  source: 'restore-envelope-test',
  parentIds: [],
  external: false,
  confidence01: 0.5,
  payload: { restored: true },
  ...overrides,
});

const seed = new CognitiveEventFabric(16);
const stored = seed.append(makeRow({ id: 'restore:kept', payload: { value: 'stable' } }));
const stableTotal = seed.snapshot().total;

// The snapshot envelope is a trust boundary: reject accessor-backed known fields
// without invoking them and without changing the already-live ledger.
let envelopeGetterCalls = 0;
const hostileEnvelope = { ...seed.snapshot() };
Object.defineProperty(hostileEnvelope, 'recent', {
  enumerable: true,
  configurable: true,
  get() { envelopeGetterCalls += 1; return []; },
});
seed.restore(hostileEnvelope);
assert.equal(envelopeGetterCalls, 0, 'restore must not execute top-level snapshot getters');
assert.equal(seed.snapshot().total, stableTotal, 'rejected envelope must not partially replace the ledger');
assert.deepEqual(seed.getById('restore:kept'), stored);

// A malformed row is skipped before reading any accessor, and must not reserve
// its ID so a subsequent valid row with that same ID can recover.
let rowGetterCalls = 0;
const hostileRow = makeRow({ id: 'restore:recoverable' });
Object.defineProperty(hostileRow, 'id', {
  enumerable: true,
  configurable: true,
  get() { rowGetterCalls += 1; return 'restore:recoverable'; },
});
const recovery = new CognitiveEventFabric(16);
recovery.restore({ recent: [hostileRow, makeRow({ id: 'restore:recoverable' })], total: 2 });
assert.equal(rowGetterCalls, 0, 'restore must not execute event row getters');
assert.deepEqual(recovery.getById('restore:recoverable')?.payload, { restored: true });
assert.equal(recovery.snapshot().total, 2);

// Sparse/accessor-backed array slots are not traversed via iteration and do not
// inject a forged event from a getter or the array prototype.
let arrayGetterCalls = 0;
const hostileRows = [makeRow({ id: 'restore:array-getter' })];
Object.defineProperty(hostileRows, '0', {
  enumerable: true,
  configurable: true,
  get() { arrayGetterCalls += 1; return makeRow({ id: 'restore:array-getter' }); },
});
const sparseRestore = new CognitiveEventFabric(16);
sparseRestore.restore({ recent: hostileRows, total: 1 });
assert.equal(arrayGetterCalls, 0, 'restore must inspect array slots through data descriptors');
assert.equal(sparseRestore.getById('restore:array-getter'), null);

// Accessor-backed parent lineage rows are rejected without running the element getter.
let parentGetterCalls = 0;
const hostileParents = ['parent:one'];
Object.defineProperty(hostileParents, '0', {
  enumerable: true,
  configurable: true,
  get() { parentGetterCalls += 1; return 'parent:one'; },
});
const parentRestore = new CognitiveEventFabric(16);
parentRestore.restore({ recent: [makeRow({ id: 'restore:parent-getter', parentIds: hostileParents })], total: 1 });
assert.equal(parentGetterCalls, 0, 'restore must not execute parent-array getters');
assert.equal(parentRestore.getById('restore:parent-getter'), null);

// A hostile receipt-index entry is ignored without executing its accessor; valid
// causal events are still restored from the same snapshot.
let receiptGetterCalls = 0;
const hostileReceipt = {};
Object.defineProperty(hostileReceipt, 'executionId', {
  enumerable: true,
  configurable: true,
  get() { receiptGetterCalls += 1; return 'exec:hostile'; },
});
const baseline = seed.snapshot();
baseline.receiptProjectionIndex = [hostileReceipt];
const receiptRestore = new CognitiveEventFabric(16);
receiptRestore.restore(baseline);
assert.equal(receiptGetterCalls, 0, 'restore must not execute receipt-index getters');
assert.equal(receiptRestore.getById('restore:kept')?.id, 'restore:kept');

console.log('Cognitive event restore envelope: PASS');
