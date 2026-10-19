import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const action='verify';
const context='e2|c2|u3|n2|g2|s1';
const lowCausal=new AdaptivePolicyEngine();
for (const actual of [.80,.81,.83,.82]) lowCausal.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
for (const [boot,reward] of [['l1',.92],['l2',.88],['l3',.90]]) {
  lowCausal.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.35,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
}
assert.equal(lowCausal.snapshot().recoveryStrategy.totalPromotions,0,'Weak causal confidence must block promotion');
assert.equal(lowCausal.snapshot().recoveryStrategy.causalBlockedEpisodes,3,'All weak-causal episodes must be counted as blocked');
assert.equal(lowCausal.recoveryStrategyBias(context,action,.5),0,'Blocked causal evidence must not change future policy');

const ambiguous=new AdaptivePolicyEngine();
for (const actual of [.80,.81,.83,.82]) ambiguous.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
for (const [boot,reward] of [['a1',.92],['a2',.88],['a3',.90]]) {
  ambiguous.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.95,selectedExpected01:.56,alternativeExpected01:.55,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
}
assert.equal(ambiguous.snapshot().recoveryStrategy.totalPromotions,0,'Low counterfactual separation must block promotion');
assert.equal(ambiguous.snapshot().recoveryStrategy.causalBlockedEpisodes,3,'Ambiguous alternatives must be counted as blocked');

const strong=new AdaptivePolicyEngine();
for (const actual of [.80,.81,.83,.82]) strong.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
for (const [boot,reward] of [['s1',.92],['s2',.88],['s3',.90]]) {
  strong.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
}
const promoted=strong.snapshot().recoveryStrategy;
assert.equal(promoted.totalPromotions,1,'Strong causal evidence should allow promotion');
assert.ok(promoted.promotions[0].meanCausalConfidence01>=.949,'Promotion should retain causal confidence evidence');
assert.ok(promoted.promotions[0].meanCounterfactualSupport01>=.699,'Promotion should retain counterfactual separation evidence');
assert.ok(strong.recoveryStrategyBias(context,action,.5)>0,'Promoted causal strategy should influence future policy');

const restored=new AdaptivePolicyEngine();
restored.restore(strong.snapshot());
assert.equal(restored.snapshot().recoveryStrategy.totalPromotions,1,'Causal promotion must survive restore');
assert.equal(restored.snapshot().recoveryStrategy.causalBlockedEpisodes,0,'Strong evidence must not be marked blocked');
assert.equal(restored.recoveryStrategyBias(context,action,.5),strong.recoveryStrategyBias(context,action,.5),'Causal promotion bias must survive restore');

console.log(JSON.stringify({status:'PASS',weakPromotions:lowCausal.snapshot().recoveryStrategy.totalPromotions,weakBlocked:lowCausal.snapshot().recoveryStrategy.causalBlockedEpisodes,ambiguousPromotions:ambiguous.snapshot().recoveryStrategy.totalPromotions,ambiguousBlocked:ambiguous.snapshot().recoveryStrategy.causalBlockedEpisodes,strongPromotions:promoted.totalPromotions,strongBias:strong.recoveryStrategyBias(context,action,.5),meanCausalConfidence:promoted.promotions[0].meanCausalConfidence01,meanCounterfactualSupport:promoted.promotions[0].meanCounterfactualSupport01},null,2));
