import assert from 'node:assert/strict';
import { P53DevelopmentalSelfModificationLab } from '../src/organism/developmental/P53DevelopmentalSelfModificationLab.ts';
const lab=new P53DevelopmentalSelfModificationLab();
const c=lab.propose({tick:12,at:1,predictionError01:.78,selfPredictionError01:.7,uncertainty01:.8,novelty01:.5,attention01:.4,identityContinuity01:.92});
assert.ok(c);
// Shadow-only evaluation cannot promote: a sealed independent holdout is required.
const shadowOnly=lab.test(c.id,{predictionError01:.3,selfPredictionError01:.2,uncertainty01:.2,identityContinuity01:.94,grounding01:.9,causalAlignment01:.9});
assert.ok(shadowOnly);
assert.equal(shadowOnly.status,'testing');
assert.equal(lab.promote(c.id,2)?.status,'testing');
const t=lab.test(c.id,{predictionError01:.3,selfPredictionError01:.2,uncertainty01:.2,identityContinuity01:.94,grounding01:.9,causalAlignment01:.9,holdout:{observed01:.95,fingerprint:'p53-sealed-holdout-manifest-a',independent:true}});
assert.ok(t);
assert.equal(t.status,'promotable');
assert.equal(t.holdoutVerified,true);
const p=lab.promote(c.id,2); assert.equal(p?.status,'promoted');
assert.ok(lab.snapshot().promotions>=1);
console.log('p53 developmental self-modification PASS');
