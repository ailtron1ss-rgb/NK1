import assert from 'node:assert/strict';
import { CanonicalActionPolicyArbiter } from '../src/organism/learning/CanonicalActionPolicyArbiter.ts';

const arbiter = new CanonicalActionPolicyArbiter();
const frame = arbiter.evaluate({
  baseUtility: .5,
  predictedUtility: .6,
  identityGate01: 1,
  sources: [
    {name:'adaptive', bias:{verify:.10, explore:.02}, confidence01:.9, causal01:.9},
    {name:'neural-p2855', bias:{verify:.08, explore:.01}, confidence01:.8, causal01:.85},
    {name:'parametric', bias:{verify:.04, explore:.03}, confidence01:.7, causal01:.7},
  ],
});
assert.ok(frame.actions.verify.contribution01 > 0);
assert.ok(frame.actions.verify.sourceCount === 3);
assert.ok(frame.meanConfidence01 > 0);
const suppressed = arbiter.evaluate({
  baseUtility:.5, predictedUtility:.5, uncertainty01:1, identityGate01:0,
  sources:[{name:'bad', bias:{verify:.14}, confidence01:0, causal01:0}]
});
assert.ok(Math.abs(suppressed.actions.verify.contribution01) < .03);
console.log(JSON.stringify({
  verifyContribution01:frame.actions.verify.contribution01,
  meanConfidence01:frame.meanConfidence01,
  disagreement01:frame.disagreement01,
  suppressedVerifyContribution01:suppressed.actions.verify.contribution01
}, null, 2));
