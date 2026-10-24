import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(128);
fabric.append({ id: 'obs-1', tick: 1, stage: 'observation', source: 'test', confidence01: 0.7, payload: { signal: 'x' } });
const naturalSource = fabric.append({ id: 'user-obs', tick: 2, stage: 'observation', source: 'user-input', confidence01: .7, payload: { signal: 'human' } });
assert.equal(naturalSource.source, 'user-input', 'ordinary source labels containing u must remain valid');
const before = fabric.snapshot();
for (const invalid of [
  { tick: Number.NaN, stage: 'prediction', source: 'test' },
  { tick: -1, stage: 'prediction', source: 'test' },
  { tick: 2, stage: 'not-a-stage', source: 'test' },
  { tick: 2, stage: 'prediction', source: 'test', confidence01: 2 },
  { tick: 2, stage: 'prediction', source: 'bad\u0001source' },
  { tick: 2, stage: 'prediction', source: 'test', parentIds: ['bad\nparent'] },
  { tick: 2, stage: 'prediction', source: 'test', payload: Object.defineProperty({}, 'secret', { enumerable: true, get() { throw new Error('getter invoked'); } }) },
]) assert.throws(() => fabric.append(invalid), /invalid-cognitive-event|cognitive-event/);
let getterCalls = 0;
const accessorEnvelope = { stage: 'prediction', source: 'test' };
Object.defineProperty(accessorEnvelope, 'tick', { enumerable: true, get() { getterCalls += 1; return 2; } });
assert.throws(() => fabric.append(accessorEnvelope), /cognitive-event-accessor-rejected/);
assert.equal(getterCalls, 0);
assert.equal(fabric.snapshot().total, before.total, 'invalid ingress must not mutate the ledger');
assert.equal(fabric.recent().length, 2);

const nestedPayload = { nested: { label: 'before-mutation' } };
fabric.append({ id: 'nested-payload', tick: 3, stage: 'observation', source: 'test', payload: nestedPayload });
nestedPayload.nested.label = 'mutated-after-append';
const detachedNode = fabric.snapshot().recent.find(node => node.id === 'nested-payload');
assert.equal(detachedNode.payload.nested.label, 'before-mutation', 'nested payload must be detached from caller-owned state');

let nestedGetterCalls = 0;
const hostileNestedPayload = {};
Object.defineProperty(hostileNestedPayload, 'secret', { enumerable: true, get() { nestedGetterCalls += 1; return 'leak'; } });
const beforeDeepReject = fabric.snapshot().total;
assert.throws(() => fabric.append({
  id: 'nested-accessor', tick: 4, stage: 'observation', source: 'test',
  payload: { nested: hostileNestedPayload },
}), /invalid-cognitive-event-payload/);
assert.equal(nestedGetterCalls, 0, 'deep payload snapshot must not execute nested getters');
const cyclicPayload = {};
cyclicPayload.self = cyclicPayload;
assert.throws(() => fabric.append({
  id: 'cyclic-payload', tick: 4, stage: 'observation', source: 'test', payload: { cyclic: cyclicPayload },
}), /invalid-cognitive-event-payload/);
assert.equal(fabric.snapshot().total, beforeDeepReject, 'rejected nested payloads must not mutate the causal ledger');

const restored = new CognitiveEventFabric(128);
let restoreGetterCalls = 0;
const hostileRow = { tick: 2, stage: 'prediction', source: 'persisted', parentIds: [], external: false, confidence01: .8, payload: {} };
Object.defineProperty(hostileRow, 'id', { enumerable: true, get() { restoreGetterCalls += 1; return 'hostile'; } });
restored.restore({ version: 1, capacity: 128, total: 1, recent: [hostileRow] });
assert.equal(restoreGetterCalls, 0, 'restoring a persisted row must not execute getters');
assert.equal(restored.recent().length, 0, 'accessor-backed restored rows must be discarded');

const hostileSnapshot = { version: 1, capacity: 128, total: 1, recent: [] };
Object.defineProperty(hostileSnapshot, 'recent', { enumerable: true, get() { restoreGetterCalls += 1; return []; } });
restored.restore(hostileSnapshot);
assert.equal(restoreGetterCalls, 0, 'snapshot top-level getters must not be executed');
assert.equal(restored.recent().length, 0);

const restoredRow = (id, parentIds) => ({
  id, tick: 3, at: 3, stage: 'learning', source: 'persisted-test',
  parentIds, external: false, confidence01: .8, payload: {},
});
restored.restore({
  version: 1, capacity: 128, total: 4,
  recent: [
    restoredRow('valid-lineage', ['parent-event']),
    restoredRow('padded-parent', [' parent-event']),
    restoredRow('control-parent', ['parent\u0000event']),
    restoredRow('duplicate-parent', ['parent-event', 'parent-event']),
    restoredRow('oversized-parent-list', Array.from({ length: 13 }, (_, i) => `parent-${i}`)),
  ],
});
assert.deepEqual(restored.recent().map(node => node.id), ['valid-lineage'],
  'restore must reject malformed lineage rather than silently rewrite causal ancestry');
assert.deepEqual(restored.recent()[0].parentIds, ['parent-event'],
  'valid persisted parent IDs must be preserved exactly');

console.log('cognitive event fabric ingress/restore boundary: ok');
