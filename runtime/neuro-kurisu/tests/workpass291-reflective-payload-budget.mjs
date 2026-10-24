import assert from 'node:assert/strict';
import {
  MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES,
  assertReflectiveSkillPayloadWithinBudget,
} from '../src/organism/learning/P23LearningEngine.ts';

assert.equal(MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES, 256 * 1024);
assert.equal(assertReflectiveSkillPayloadWithinBudget({ b: 2, a: 1 }), '{"a":1,"b":2}',
  'budget guard returns the same canonical representation used by the P23 fingerprint');
assert.doesNotThrow(() => assertReflectiveSkillPayloadWithinBudget('x'.repeat(MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES - 2)),
  'payload exactly at the byte budget remains eligible for downstream evaluation');
assert.throws(
  () => assertReflectiveSkillPayloadWithinBudget('x'.repeat(MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES - 1), 'generated'),
  /p23-reflective-skill-payload-too-large:generated:/,
  'oversized generated payload is rejected before independent evaluation');
const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => assertReflectiveSkillPayloadWithinBudget(cyclic), /p23-canonicalization-circular-value/,
  'circular payloads fail closed rather than bypassing the byte bound');
assert.throws(() => assertReflectiveSkillPayloadWithinBudget({ value: Number.NaN }),
  /p23-canonicalization-non-finite-number/,
  'non-finite payloads fail closed before hashing or execution');

let getterCalls=0;
const getterPayload=Object.defineProperty({},'secret',{
  enumerable:true,get(){getterCalls++;return 'must-not-be-read';},
});
assert.throws(()=>assertReflectiveSkillPayloadWithinBudget(getterPayload,'generated'),
  /p23-reflective-skill-payload-data-boundary-rejected:generated/,
  'getter-bearing payloads are rejected before fingerprinting');
assert.equal(getterCalls,0,'payload fingerprinting must not invoke an accessor');
assert.throws(()=>assertReflectiveSkillPayloadWithinBudget(['present',,],'generated'),
  /p23-reflective-skill-payload-data-boundary-rejected:generated/,
  'sparse arrays cannot bypass payload fingerprint and budget checks');
assert.throws(()=>assertReflectiveSkillPayloadWithinBudget(Object.assign([], {extra:'not-json'}),'generated'),
  /p23-reflective-skill-payload-data-boundary-rejected:generated/,
  'arrays with hidden semantic properties cannot produce ambiguous payload fingerprints');
console.log('WORKPASS291_REFLECTIVE_PAYLOAD_BUDGET=PASS');
