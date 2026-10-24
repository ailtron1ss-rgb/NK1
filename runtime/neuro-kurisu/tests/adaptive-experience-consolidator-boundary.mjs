import assert from 'node:assert/strict';
import { AdaptiveExperienceConsolidator } from '../src/organism/memory/AdaptiveExperienceConsolidator.ts';

const store = new AdaptiveExperienceConsolidator(16);
const ordinaryUserTagStore = new AdaptiveExperienceConsolidator(16);
ordinaryUserTagStore.ingest({ id: 'user-tag-episode', timestamp: 1, novelty: .5, utility: .5, uncertainty: .5, tags: ['user-input'] });
assert.equal(ordinaryUserTagStore.size(), 1, 'ordinary tags containing u remain valid');
assert.throws(() => ordinaryUserTagStore.ingest({ id: 'control-tag-episode', timestamp: 2, novelty: .5, utility: .5, uncertainty: .5, tags: ['bad\u0001tag'] }), /experience-record-invalid/);
const valid = { id: 'episode-1', timestamp: 10, novelty: 0.8, utility: 0.7, uncertainty: 0.2, tags: ['decision'] };
store.ingest(valid);
assert.equal(store.size(), 1);
assert.throws(() => store.ingest(valid), /experience-id-duplicate/);
assert.deepEqual(store.consolidate(0), [], 'zero limit must not silently retain one memory');

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
const accessorTags = [];
Object.defineProperty(accessorTags, '0', { enumerable: true, get() { getterCalls += 1; return 'hidden'; } });
accessorTags.length = 1;
assert.throws(() => store.ingest({ ...valid, id: 'episode-with-hostile-tags', tags: accessorTags }), /experience-record-invalid/);
assert.equal(getterCalls, 0, 'normalizing tag arrays must not execute index getters');
assert.equal(store.size(), 1, 'rejected ingress must not mutate memory');

store.restore([valid, { ...valid, id: 'bad', uncertainty: Infinity }, { ...valid, id: 'episode-2' }, { ...valid, utility: 0.95 }]);
assert.deepEqual(store.snapshot().map(row => row.id), ['episode-2', 'episode-1']);
assert.equal(store.snapshot()[1].utility, 0.95, 'restore must retain the last valid revision for a repeated ID');
const consolidated = store.consolidate();
consolidated[0].tags.push('mutated-outside');
assert.equal(store.snapshot()[0].tags.includes('mutated-outside'), false);
assert.equal(new AdaptiveExperienceConsolidator(Number.NaN).size(), 0);
console.log('adaptive experience consolidation boundary: ok');
