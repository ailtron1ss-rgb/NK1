import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const action='verify';
const context='e2|c2|u3|n2|g2|s1';
const make=(opts={})=>new AdaptivePolicyEngine();

const modelOnly=make();
for (const [boot,reward] of [['m1',.92],['m2',.88],['m3',.90]]) modelOnly.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'model',matchedTrials:0,independent:true,autonomous:true});
assert.equal(modelOnly.snapshot().recoveryStrategy.totalPromotions,0);
assert.equal(modelOnly.snapshot().recoveryStrategy.causalBlockedEpisodes,3);

const oneMatched=make();
for (const actual of [.80,.81,.83]) oneMatched.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
for (const [boot,reward] of [['o1',.92],['o2',.88],['o3',.90]]) oneMatched.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:1,independent:true,autonomous:true});
assert.equal(oneMatched.snapshot().recoveryStrategy.totalPromotions,0);
assert.equal(oneMatched.snapshot().recoveryStrategy.matchedCounterfactuals,3);

const matched=make();
for (const actual of [.80,.81,.83]) matched.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
for (const [boot,reward] of [['s1',.92],['s2',.88],['s3',.90]]) matched.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
assert.equal(matched.snapshot().recoveryStrategy.totalPromotions,1);
assert.ok(matched.snapshot().recoveryStrategy.promotions[0].meanMatchedTrials>=2.99);

const restored=new AdaptivePolicyEngine();
restored.restore(matched.snapshot());
assert.equal(restored.snapshot().recoveryStrategy.totalPromotions,1);
assert.equal(restored.snapshot().recoveryStrategy.version,4);
assert.equal(restored.snapshot().recoveryStrategy.matchedCounterfactuals,3);
assert.equal(restored.snapshot().recoveryStrategy.promotions[0].meanMatchedTrials,matched.snapshot().recoveryStrategy.promotions[0].meanMatchedTrials);

console.log(JSON.stringify({status:'PASS',modelBlocked:modelOnly.snapshot().recoveryStrategy.causalBlockedEpisodes,oneMatchedBlocked:oneMatched.snapshot().recoveryStrategy.causalBlockedEpisodes,matchedPromotions:matched.snapshot().recoveryStrategy.totalPromotions,matchedCounterfactuals:matched.snapshot().recoveryStrategy.matchedCounterfactuals,meanMatchedTrials:matched.snapshot().recoveryStrategy.promotions[0].meanMatchedTrials},null,2));
