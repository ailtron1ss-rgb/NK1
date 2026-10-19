import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const action='verify';
const context='e2|c2|u3|n2|g2|s1';
const related='e2|c2|u3|n2|g3|s1';
const unrelated='e0|c0|u0|n0|g0|s0';
const policy=new AdaptivePolicyEngine();
for (const actual of [.80,.81,.83,.82]) policy.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});

const episode=(bootId,reward,ctx=context)=>policy.observeRecoveryOutcome({
  bootId, contextKey:ctx, action, reward, causalConfidence01:.95, selectedExpected01:.82, alternativeExpected01:.42, counterfactualSource:'matched-simulated', matchedTrials:3, independent:true, autonomous:true,
});

for (const [boot,reward] of [['p1',.92],['p2',.88],['p3',.90]]) episode(boot,reward);
const positive=policy.recoveryStrategyBias(context,action,.5);
assert.ok(positive>0.0001,'Positive evidence must create positive learned strategy');

const beforeReverse=policy.snapshot().recoveryStrategy.promotions[0];
assert.equal(beforeReverse.status,'active');
assert.equal(beforeReverse.reversalCount,0);

for (const [boot,reward] of [['n1',.08],['n2',.12],['n3',.10],['n4',.14],['n5',.09],['n6',.11]]) episode(boot,reward);
const after=policy.snapshot().recoveryStrategy.promotions[0];
const negative=policy.recoveryStrategyBias(context,action,.5);
const relatedNegative=policy.recoveryStrategyBias(related,action,.5);
const unrelatedNegative=policy.recoveryStrategyBias(unrelated,action,.5);

assert.ok(after.effect01<0,'Repeated contrary evidence must reverse the learned effect');
assert.ok(negative<0,'Reversed strategy must change future behaviour in the opposite direction');
assert.ok(after.reversalCount>=1,'Reversal must be explicitly recorded');
assert.ok(after.contradictionCount>=1,'Contradictory evidence must be recorded');
assert.ok(relatedNegative<0,'Reversal may transfer only to a semantically close holdout context');
assert.equal(unrelatedNegative,0,'Reversal must not leak into unrelated context');

const restored=new AdaptivePolicyEngine();
restored.restore(policy.snapshot());
assert.equal(restored.snapshot().recoveryStrategy.promotions[0].status,after.status);
assert.equal(restored.snapshot().recoveryStrategy.promotions[0].reversalCount,after.reversalCount);
assert.equal(restored.recoveryStrategyBias(context,action,.5),negative,'Reversal must persist exactly across restore');
assert.equal(restored.snapshot().recoveryStrategy.promotions[0].status,'reversed');

console.log(JSON.stringify({status:'PASS',positive,negative,relatedNegative,unrelatedNegative,effect01:after.effect01,statusAfter:after.status,reversalCount:after.reversalCount,contradictionCount:after.contradictionCount,episodes:restored.snapshot().recoveryStrategy.totalEpisodes,totalPromotions:restored.snapshot().recoveryStrategy.totalPromotions},null,2));
