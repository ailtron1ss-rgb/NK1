import assert from 'node:assert/strict';
import { AdaptiveExperienceConsolidator } from '../src/organism/memory/AdaptiveExperienceConsolidator.ts';

const record = (id, overrides = {}) => ({
  id,
  timestamp: 1_700_000_000_000,
  novelty: 0.5,
  utility: 0.6,
  uncertainty: 0.2,
  tags: ['episodic', 'test'],
  ...overrides,
});

const memory = new AdaptiveExperienceConsolidator(16);
const source = record('detached');
assert.equal(memory.ingest(source), true);
source.tags.push('mutated-after-ingest');
assert.deepEqual(memory.snapshot()[0].tags, ['episodic', 'test']);
assert.equal(memory.ingest(record('clamped', { novelty: 4, utility: -2, uncertainty: 2 })), true);
assert.deepEqual(
  memory.snapshot().find((item) => item.id === 'clamped'),
  { ...record('clamped'), novelty: 1, utility: 0, uncertainty: 1 },
);

assert.equal(memory.ingest(record('blank-id', { id: '   ' })), false);
assert.equal(memory.ingest(record('bad-time', { timestamp: Number.POSITIVE_INFINITY })), false);
assert.equal(memory.ingest(record('bad-metric', { utility: Number.NaN })), false);
assert.equal(memory.ingest(record('too-many-tags', { tags: Array.from({ length: 25 }, (_, i) => String(i)) })), false);
assert.equal(memory.ingest(record('bad-tag', { tags: [''] })), false);

let getterCalls = 0;
const accessorRecord = record('accessor');
Object.defineProperty(accessorRecord, 'utility', {
  enumerable: true,
  get() { getterCalls += 1; return 1; },
});
assert.equal(memory.ingest(accessorRecord), false);
assert.equal(getterCalls, 0);

const hostileProxy = new Proxy(record('proxy'), {
  ownKeys() { throw new Error('proxy trap'); },
});
assert.equal(memory.ingest(hostileProxy), false);

const sparseTags = [];
sparseTags.length = 1;
assert.equal(memory.ingest(record('sparse-tags', { tags: sparseTags })), false);

assert.deepEqual(memory.consolidate(0), []);
assert.deepEqual(memory.consolidate(-1), []);
assert.deepEqual(memory.consolidate(Number.NaN), []);
assert.equal(memory.consolidate(1).length, 1);

// Equal retention scores are deterministic: newest timestamp, then lexical ID.
const ordered = new AdaptiveExperienceConsolidator();
ordered.ingest(record('z', { timestamp: 10 }));
ordered.ingest(record('b', { timestamp: 20 }));
ordered.ingest(record('a', { timestamp: 20 }));
assert.deepEqual(ordered.consolidate().map((item) => item.id), ['a', 'b', 'z']);

const output = ordered.consolidate();
output[0].tags.push('output-mutation');
assert.deepEqual(ordered.snapshot()[0].tags, ['episodic', 'test']);

const restored = new AdaptiveExperienceConsolidator();
const restoreInput = [
  record('keep'),
  record('duplicate', { timestamp: 2 }),
  record('duplicate', { timestamp: 3 }),
  record('invalid', { uncertainty: Number.NaN }),
];
restored.restore(restoreInput);
assert.deepEqual(restored.snapshot().map((item) => item.id), ['keep', 'duplicate']);
restoreInput[0].tags.push('restore-mutation');
assert.deepEqual(restored.snapshot()[0].tags, ['episodic', 'test']);

const bounded = new AdaptiveExperienceConsolidator(16);
bounded.restore(Array.from({ length: 40 }, (_, index) => record(`r${index}`, { timestamp: index })));
assert.equal(bounded.size(), 16);
assert.equal(bounded.snapshot()[0].id, 'r24');

const hostileRestore = new Proxy([record('x')], {
  getOwnPropertyDescriptor() { throw new Error('restore proxy trap'); },
});
assert.doesNotThrow(() => restored.restore(hostileRestore));
assert.equal(restored.size(), 0);

console.log('adaptive-experience-consolidator: PASS');
