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

// Duplicate provenance labels must aggregate rather than overwrite in the
// diagnostic frame, while sourceCount continues to report physical contributors.
const duplicateNames = arbiter.evaluate({
  baseUtility: .5, predictedUtility: .5,
  sources: [
    {name:'shared-family', bias:{verify:.10}, confidence01:1, causal01:1},
    {name:'shared-family', bias:{verify:.08}, confidence01:1, causal01:1},
  ],
});
assert.equal(duplicateNames.actions.verify.sourceCount, 2);
assert.ok(duplicateNames.actions.verify.sourceContributions01['shared-family'] > .08);
assert.ok(duplicateNames.actions.verify.contribution01 > 0);

// Disabled sources are absent from both signal and source counts; malformed
// numeric inputs are bounded and cannot inject NaN into the policy frame.
const disabled = arbiter.evaluate({
  baseUtility: .5, predictedUtility: .5,
  sources: [{name:'disabled', bias:{verify:.14}, confidence01:1, enabled:false}],
});
assert.equal(disabled.actions.verify.sourceCount, 0);
assert.equal(disabled.actions.verify.contribution01, 0);
const malformed = arbiter.evaluate({
  baseUtility: .5, predictedUtility: .5, computeBudget01: Number.NaN,
  uncertainty01: Number.POSITIVE_INFINITY, identityGate01: Number.NaN,
  sources: [
    null,
    {name:'malformed', bias:{verify:Number.NaN, explore:999}, confidence01:Number.NaN, causal01:Number.NaN},
    {name:'', bias:{verify:.14}, confidence01:1, causal01:1},
    {name:'oversized-name'.repeat(20), bias:{verify:.14}, confidence01:1, causal01:1},
  ],
});
for (const action of Object.values(malformed.actions)) {
  assert.ok(Number.isFinite(action.contribution01));
  assert.ok(action.contribution01 >= -.14 && action.contribution01 <= .14);
  assert.ok(Number.isFinite(action.confidence01));
}
assert.equal(malformed.actions.verify.contribution01, 0,
  'NaN confidence/bias and malformed source rows must fail closed instead of retaining midpoint authority');
assert.equal(malformed.actions.explore.contribution01, 0,
  'malformed control signals must not let an out-of-range proposal affect the policy frame');
assert.ok(Number.isFinite(malformed.totalSignal01));
const missingSources = arbiter.evaluate({baseUtility:.5,predictedUtility:.5,sources:null});
assert.equal(missingSources.actions.verify.sourceCount,0,'non-array sources must degrade to an empty policy frame');
const oversizedFrame = arbiter.evaluate({baseUtility:.5,predictedUtility:.5,sources:Array.from({length:257},(_,i)=>({name:`source-${i}`,bias:{verify:.14},confidence01:1,causal01:1}))});
assert.equal(oversizedFrame.actions.verify.sourceCount,0,'oversized policy frames must fail closed rather than letting a truncated prefix dominate');
const provenanceFrame = arbiter.evaluate({baseUtility:.5,predictedUtility:.5,sources:[{name:' family ',bias:{verify:.10},confidence01:1,causal01:1},{name:'family',bias:{verify:.08},confidence01:1,causal01:1},{name:'bad\u0000name',bias:{verify:.14},confidence01:1,causal01:1}]});
assert.ok(provenanceFrame.actions.verify.sourceContributions01.family > .08,'trim-equivalent provenance labels aggregate into one canonical diagnostic key');
assert.equal(Object.keys(provenanceFrame.actions.verify.sourceContributions01).some(name=>name.includes('bad')),false,'control-character provenance labels are rejected');
console.log(JSON.stringify({
  verifyContribution01:frame.actions.verify.contribution01,
  meanConfidence01:frame.meanConfidence01,
  disagreement01:frame.disagreement01,
  suppressedVerifyContribution01:suppressed.actions.verify.contribution01
}, null, 2));
