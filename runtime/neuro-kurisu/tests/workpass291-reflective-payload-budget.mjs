import assert from 'node:assert/strict';
import {
  MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES,
  assertReflectiveSkillPayloadWithinBudget,
} from '../src/organism/learning/P23LearningEngine.ts';

const maxBytes = MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES;
assert.equal(maxBytes, 256 * 1024, 'reflective candidate ceiling must remain explicit and bounded');

const exactAscii = 'x'.repeat(maxBytes - 2);
const exactCanonical = assertReflectiveSkillPayloadWithinBudget(exactAscii, 'boundary');
assert.equal(Buffer.byteLength(exactCanonical, 'utf8'), maxBytes,
  'a canonical UTF-8 payload exactly at the budget must be accepted');

assert.throws(
  () => assertReflectiveSkillPayloadWithinBudget('x'.repeat(maxBytes - 1), 'oversized'),
  error => error instanceof Error &&
    error.message.startsWith('p23-reflective-skill-payload-too-large:oversized:') &&
    Number(error.message.split(':').at(-1)) === maxBytes + 1,
  'one byte above the limit must be rejected with the measured UTF-8 size',
);

const exactMultibyte = 'é'.repeat((maxBytes - 2) / 2);
const multibyteCanonical = assertReflectiveSkillPayloadWithinBudget(exactMultibyte, 'utf8-boundary');
assert.equal(Buffer.byteLength(multibyteCanonical, 'utf8'), maxBytes,
  'the budget must count UTF-8 bytes, not JavaScript UTF-16 code units');

assert.equal(
  assertReflectiveSkillPayloadWithinBudget({ z: 1, a: 2 }),
  assertReflectiveSkillPayloadWithinBudget({ a: 2, z: 1 }),
  'canonical payload encoding must be stable across object key order',
);

assert.throws(() => assertReflectiveSkillPayloadWithinBudget({ score: Number.NaN }), /non-finite-number/);
const circular = {};
circular.self = circular;
assert.throws(() => assertReflectiveSkillPayloadWithinBudget(circular), /circular-value/);
assert.throws(() => assertReflectiveSkillPayloadWithinBudget(new Date()), /non-plain-object/);

console.log('WORKPASS291_REFLECTIVE_PAYLOAD_BUDGET=PASS');
