import test from 'node:test';
import assert from 'node:assert/strict';
import { combineRankedMemoryChannels, compareRankedLists } from '../src/hybrid-recall.mjs';

test('RRF follows the one-based rank equation and rewards agreement', () => {
  const r = combineRankedMemoryChannels({ channels: [
    { name: 'bm25', candidates: [{ id: 'both' }, { id: 'lexical' }] },
    { name: 'vector', candidates: [{ id: 'both' }, { id: 'semantic' }] },
  ] });
  assert.equal(r.items[0].id, 'both');
  assert.ok(Math.abs(r.items[0].score - 2 / 61) < Number.EPSILON);
  assert.equal(r.items[0].ranks.length, 2);
});
test('subject scope is enforced before scoring and missing owners fail closed', () => {
  const r = combineRankedMemoryChannels({ subjectId: 'alice', channels: [
    { name: 'bm25', candidates: [{ id: 'private', subjectId: 'bob' }, { id: 'owned', subjectId: 'alice' }] },
    { name: 'vector', candidates: [{ id: 'owned', subjectId: 'alice' }, { id: 'unknown' }] },
  ] });
  assert.deepEqual(r.items.map(x => x.id), ['owned']);
  assert.equal(r.diagnostics.candidatesScopedOut, 2);
  assert.equal(r.items[0].score, 1 / 62 + 1 / 61);
});
test('duplicates within a channel contribute only once', () => {
  const r = combineRankedMemoryChannels({ channels: [{ name: 'bm25', candidates: [{ id: 'x' }, { id: 'x' }] }] });
  assert.equal(r.items[0].score, 1 / 61);
  assert.equal(r.diagnostics.duplicateRefs, 1);
});
test('weights and input sizes are bounded', () => {
  assert.throws(() => combineRankedMemoryChannels({ channels: [{ name: 'bm25', weight: 4.1, candidates: [] }] }), /weight/);
  assert.throws(() => combineRankedMemoryChannels({ channels: [], limit: 0 }), /channels/);
  const candidates = Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i }));
  const r = combineRankedMemoryChannels({ channels: [{ name: 'bm25', candidates }], maxCandidatesPerChannel: 10, limit: 4 });
  assert.equal(r.items.length, 4);
  assert.equal(r.diagnostics.candidatesSeen, 10);
});
test('malformed and prototype-bearing records fail closed', () => {
  assert.throws(() => combineRankedMemoryChannels(null), /plain.*record/);
  assert.throws(() => combineRankedMemoryChannels({ channels: [{ name: 'bm25', candidates: [{ id: '' }] }] }), /invalid/);
  const hostile = Object.create({ inherited: true }); hostile.name = 'bm25'; hostile.candidates = [];
  assert.throws(() => combineRankedMemoryChannels({ channels: [hostile] }), /plain.*record/);
});
test('channel identifiers are unique and bounded', () => {
  assert.throws(() => combineRankedMemoryChannels({ channels: [
    { name: 'bm25', candidates: [] }, { name: 'bm25', candidates: [] },
  ] }), /duplicate/);
  assert.throws(() => combineRankedMemoryChannels({ channels: [{ name: 'bad name', candidates: [] }] }), /name/);
});
test('rank comparison is bounded and deterministic', () => {
  assert.deepEqual(compareRankedLists([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }], 2),
    { leftCount: 2, rightCount: 2, overlapAtK: 1, jaccardAtK: 1 / 3 });
  assert.throws(() => compareRankedLists([], [], 0), /bounds/);
});
test('accessor-backed input and candidate fields are rejected without invoking getters', () => {
  let inputGetterCalled = false;
  const unsafeInput = {};
  Object.defineProperty(unsafeInput, 'channels', {
    get() { inputGetterCalled = true; throw new Error('input getter executed'); },
  });
  assert.throws(() => combineRankedMemoryChannels(unsafeInput), /plain.*record|accessor|invalid/);
  assert.equal(inputGetterCalled, false);
  let candidateGetterCalled = false;
  const unsafeCandidate = {};
  Object.defineProperty(unsafeCandidate, 'id', {
    get() { candidateGetterCalled = true; throw new Error('candidate getter executed'); },
  });
  assert.throws(() => combineRankedMemoryChannels({
    channels: [{ name: 'bm25', candidates: [unsafeCandidate] }],
  }), /plain.*record|accessor|invalid/);
  assert.equal(candidateGetterCalled, false);
});
