import assert from 'node:assert/strict';
import { defaultP32CausalSelfModel } from '../src/organism/cognition/P32CausalSelfModel.ts';
const s=defaultP32CausalSelfModel();
assert.equal(s.version,1);
assert.ok(!('subjectiveExperience01' in s));
console.log('P32_TRUTHFULNESS=PASS');
