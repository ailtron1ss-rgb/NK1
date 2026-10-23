import assert from 'node:assert/strict';
import { assertCognitiveCycleBoundaryInput } from '../src/organism/core/CognitiveCycleBoundary.ts';

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
console.log('NK1_COGNITIVE_CYCLE_BOUNDARY=PASS assertions=9 modes=2 rejectsMalformedObservation=true rejectsInvalidMode=true mutation=false');
