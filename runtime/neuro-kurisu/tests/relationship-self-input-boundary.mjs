import assert from 'node:assert/strict';
import { RelationshipSelf } from '../src/organism/developmental/RelationshipSelf.ts';

const self = new RelationshipSelf();
const first = self.observe('research-partner', 0.8, 0.7);
assert.equal(first.person, 'research-partner');
assert.equal(self.snapshot().models.length, 1);
for (const args of [
  ['bad', Number.NaN, 0.5],
  ['bad', 0.5, Infinity],
  ['bad', -0.1, 0.5],
  ['bad', 0.5, 1.1],
  [' invalid ', 0.5, 0.5],
]) {
  assert.throws(() => self.observe(...args), /relationship-observation-invalid/);
  assert.equal(self.snapshot().models.length, 1, 'invalid observation must not mutate the relationship model');
}
assert.throws(() => self.observe('bad\u0000id', 0.5, 0.5), /relationship-observation-invalid/);
console.log('RELATIONSHIP_SELF_INPUT_BOUNDARY=PASS invalidObservationsRejectedBeforeMutation=true');
