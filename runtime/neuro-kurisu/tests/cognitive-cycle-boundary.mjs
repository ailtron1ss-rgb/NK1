import assert from 'node:assert/strict';
import { assertCognitiveCycleBoundaryInput, normalizeCognitiveCycleBoundaryInput } from '../src/organism/core/CognitiveCycleBoundary.ts';

for (const mode of ['full', 'operational']) {
  assert.doesNotThrow(() => assertCognitiveCycleBoundaryInput({}, mode));
  assert.doesNotThrow(() => assertCognitiveCycleBoundaryInput({ text: 'hello', reward: 0 }, mode));
}
assert.throws(() => assertCognitiveCycleBoundaryInput(null, 'full'), /cognitive-cycle-observation-must-be-object/);
assert.throws(() => assertCognitiveCycleBoundaryInput([], 'full'), /cognitive-cycle-observation-must-be-object/);
assert.throws(() => assertCognitiveCycleBoundaryInput('bad-input', 'full'), /cognitive-cycle-observation-must-be-object/);
assert.throws(() => assertCognitiveCycleBoundaryInput({}, 'spine-only'), /cognitive-cycle-mode-must-be-full-or-operational/);
assert.throws(() => assertCognitiveCycleBoundaryInput({}, undefined), /cognitive-cycle-mode-must-be-full-or-operational/);
const input = { text: 'immutable', reward: 0 };
assert.doesNotThrow(() => assertCognitiveCycleBoundaryInput(input, 'operational'));
assert.deepEqual(input, { text: 'immutable', reward: 0 }, 'validation must not mutate the caller observation');
const nestedInput = { text: 'snapshot-me', nested: { value: 1 } };
const detachedInput = normalizeCognitiveCycleBoundaryInput(nestedInput, 'full');
assert.notStrictEqual(detachedInput, nestedInput, 'normalized observation must be a detached root object');
assert.notStrictEqual(detachedInput.nested, nestedInput.nested, 'nested observations must be detached too');
nestedInput.nested.value = 99;
assert.equal((detachedInput.nested as { value: number }).value, 1,
  'post-validation caller mutation must not alter the observation consumed by the cognitive cycle');
let observationGetterCalls = 0;
const getterInput = Object.defineProperty({}, 'text', {
  enumerable: true, get() { observationGetterCalls++; return 'must-not-run'; },
});
assert.throws(() => normalizeCognitiveCycleBoundaryInput(getterInput, 'full'), /cognitive-cycle-observation-must-be-plain-data/);
assert.equal(observationGetterCalls, 0, 'detached snapshot validation must not invoke untrusted getters');
console.log('NK1_COGNITIVE_CYCLE_BOUNDARY=PASS assertions=9 modes=2 rejectsMalformedObservation=true rejectsInvalidMode=true mutation=false');
