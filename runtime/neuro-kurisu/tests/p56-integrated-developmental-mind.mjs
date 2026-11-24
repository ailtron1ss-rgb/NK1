import assert from 'node:assert/strict';
import { P56IntegratedDevelopmentalMind } from '../src/organism/developmental/P56IntegratedDevelopmentalMind.ts';
const e=new P56IntegratedDevelopmentalMind();
const plan=e.assess(12,100,{predictionError01:.7,selfPredictionError01:.5,identity01:.92,grounding01:.72,causalAlignment01:.61,workspace01:.7,interoceptiveError01:.15,uncertainty01:.55,novelty01:.7,memoryPressure01:.4,developmentalReadiness01:.7,realityGap01:.2});
assert.ok(['observe','repair','consolidate','experiment','protect','explore'].includes(plan.mode));
assert.ok(plan.nextEvidence.length>0);
const snap=e.snapshot(); assert.equal(snap.assessments,1); assert.equal(snap.history.length,1);
const e2=new P56IntegratedDevelopmentalMind(); e2.restore(snap); assert.deepEqual(e2.snapshot(),snap);
console.log('P56 integrated developmental mind: PASS');
