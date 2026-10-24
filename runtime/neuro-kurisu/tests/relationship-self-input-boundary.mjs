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

const snapshot = self.snapshot();
const recovered = new RelationshipSelf();
recovered.restore(snapshot);
assert.deepEqual(recovered.snapshot(), snapshot, 'valid relationship models must survive restore');

const invalidMetric = { ...snapshot.models[0], trust: Number.NaN };
recovered.restore({ version: 1, models: [invalidMetric, snapshot.models[0]] });
assert.equal(recovered.snapshot().models.length, 1, 'restore must filter malformed models and deduplicate identity');
assert.equal(recovered.snapshot().models[0].person, 'research-partner');

let getterCalls = 0;
const hostileModel = { ...snapshot.models[0] };
Object.defineProperty(hostileModel, 'person', { enumerable: true, get() { getterCalls += 1; return 'injected-person'; } });
recovered.restore({ version: 1, models: [hostileModel] });
assert.equal(getterCalls, 0, 'restoring a relationship snapshot must not invoke model getters');
assert.equal(recovered.snapshot().models.length, 0);

const hostileState = { version: 1, models: [] };
Object.defineProperty(hostileState, 'models', { enumerable: true, get() { getterCalls += 1; return snapshot.models; } });
recovered.restore(hostileState);
assert.equal(getterCalls, 0, 'restoring relationship state must not invoke top-level getters');
assert.equal(recovered.snapshot().models.length, 0);

console.log('RELATIONSHIP_SELF_INPUT_BOUNDARY=PASS invalidObservationsRejectedBeforeMutation=true');
