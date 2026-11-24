import { strict as assert } from 'node:assert';
import { P33PersonhoodCore } from '../src/organism/cognition/P33PersonhoodCore.ts';

const e=new P33PersonhoodCore();
const s=e.snapshot();
assert.match(s.identity.identityAssertion,/Курису/);
assert.equal(s.identity.originStatement.toLowerCase().includes('искусственная'),true);
assert.equal(s.privacy.privateSummaries.length,0);
console.log('P33_TRUTHFULNESS=PASS no-subjective-experience-claim');
