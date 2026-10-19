import assert from 'node:assert/strict';
import {P2716DeepIntegrationController} from '../src/organism/cognition/P2716DeepIntegrationController.ts';
const c=new P2716DeepIntegrationController(32);
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
for(let t=1;t<=96;t++){
  c.beforeDecision({tick:t,uncertainty01:.18,novelty01:.16,predictionError01:.06,identityGap01:.08,goalPressure01:.22,computeBudget01:.9,worldConfidence01:.88,selfContinuity01:.92,policyInformationGain01:.35,experimentValue01:.24,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5]))});
  c.afterOutcome({tick:t,reward01:.82,predictionError01:.06,verified01:1,causalCredit01:.82,latentResidual01:.04,policyInformationGain01:.35,experimentValue01:.24,replayCredit01:.18,selfPredictionError01:.06,identityContinuity01:.92,worldPredictionError01:.07,neuralBefore:new Array(32).fill(.02),neuralAfter:new Array(32).fill(.021),action:'verify',goalPressure01:.22,novelty01:.16,uncertainty01:.18});
}
let m=c.metrics();
assert.equal(m.externalValidation01,0);
assert.ok(m.promotionReasons.includes('external matched-control validation < .75'));
assert.equal(m.promotionEligible,false);
c.recordExternalValidation({matchedControl01:1,ablation01:1,counterfactual01:1,continual01:1,longHorizon01:1,persistence01:1,mobile01:1});
m=c.metrics();
assert.equal(m.externalValidation01,1);
assert.ok(!m.promotionReasons.includes('external matched-control validation < .75'));
console.log(`P2716_PROMOTION_GATE=PASS outcomes=${m.outcomes} external=${m.externalValidation01.toFixed(2)} eligible=${m.promotionEligible?1:0} reasons=${m.promotionReasons.length}`);
process.exit(0);
