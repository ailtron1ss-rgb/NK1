import assert from 'node:assert/strict';
import { AdaptiveExperienceConsolidator } from '../src/organism/memory/AdaptiveExperienceConsolidator.ts';

const store = new AdaptiveExperienceConsolidator(16);
const valid = { id: 'episode-1', timestamp: 10, novelty: 0.8, utility: 0.7, uncertainty: 0.2, tags: ['decision'] };
store.ingest(valid);
assert.equal(store.size(), 1);

for (const invalid of [
  { ...valid, id: ' bad' },
  { ...valid, timestamp: Number.NaN },
  { ...valid, novelty: 1.1 },
  { ...valid, tags: Array.from({ length: 25 }, (_, i) => String(i)) },
]) assert.throws(() => store.ingest(invalid), /experience-record-invalid/);

let getterCalls = 0;
const accessor = { ...valid };
Object.defineProperty(accessor, 'utility', { enumerable: true, get() { getterCalls += 1; return 0.9; } });
assert.throws(() => store.ingest(accessor), /experience-record-invalid/);
assert.equal(getterCalls, 0);
assert.equal(store.size(), 1, 'rejected ingress must not mutate memory');

store.restore([valid, { ...valid, id: 'bad', uncertainty: Infinity }, { ...valid, id: 'episode-2' }]);
assert.deepEqual(store.snapshot().map(row => row.id), ['episode-1', 'episode-2']);
const consolidated = store.consolidate();
consolidated[0].tags.push('mutated-outside');
assert.equal(store.snapshot()[0].tags.includes('mutated-outside'), false);
assert.equal(new AdaptiveExperienceConsolidator(Number.NaN).size(), 0);
console.log('adaptive experience consolidation boundary: ok');
