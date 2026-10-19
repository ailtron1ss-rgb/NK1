import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const context='e2|c1|u3|n1|g2|s1';
const action='verify';

function calibrate(p, values){
  for(const value of values){
    const d=p.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:value.expected,actualSelectedReward01:value.actual});
    assert.equal(d.key,`${context}::${action}`);
  }
}

const bad=new AdaptivePolicyEngine();
calibrate(bad,[{expected:.90,actual:.30},{expected:.80,actual:.35},{expected:.85,actual:.25}]);
for(const boot of ['bad1','bad2','bad3']){
  bad.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward:.92,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
}
assert.equal(bad.snapshot().recoveryStrategy.totalPromotions,0);
assert(bad.snapshot().recoveryStrategy.matchedCalibrationByKey[`${context}::${action}`].score01 < .70);

const good=new AdaptivePolicyEngine();
calibrate(good,[{expected:.82,actual:.80},{expected:.78,actual:.81},{expected:.85,actual:.83},{expected:.80,actual:.82}]);
for(const boot of ['good1','good2','good3']){
  good.observeRecoveryOutcome({bootId:boot,contextKey:context,action,reward:.92,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
}
const goodSnap=good.snapshot();
assert.equal(goodSnap.recoveryStrategy.totalPromotions,1);
assert(goodSnap.recoveryStrategy.matchedCalibrationByKey[`${context}::${action}`].score01 >= .70);
assert.equal(goodSnap.recoveryStrategy.version,4);

const restored=new AdaptivePolicyEngine();
restored.restore(goodSnap);
const restoredSnap=restored.snapshot();
assert.equal(restoredSnap.recoveryStrategy.version,4);
assert.equal(restoredSnap.recoveryStrategy.totalPromotions,1);
assert.equal(restoredSnap.recoveryStrategy.matchedCalibrationByKey[`${context}::${action}`].trials,4);

const unrelated=new AdaptivePolicyEngine();
calibrate(unrelated,[{expected:.82,actual:.80},{expected:.78,actual:.81},{expected:.85,actual:.83}]);
unrelated.observeRecoveryOutcome({bootId:'x1',contextKey:context,action:'rest',reward:.92,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
unrelated.observeRecoveryOutcome({bootId:'x2',contextKey:context,action:'rest',reward:.88,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
unrelated.observeRecoveryOutcome({bootId:'x3',contextKey:context,action:'rest',reward:.90,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
assert.equal(unrelated.snapshot().recoveryStrategy.totalPromotions,0,'calibration must not transfer across action key');

console.log(JSON.stringify({
  status:'PASS',
  badScore:bad.snapshot().recoveryStrategy.matchedCalibrationByKey[`${context}::${action}`].score01,
  goodScore:goodSnap.recoveryStrategy.matchedCalibrationByKey[`${context}::${action}`].score01,
  promotions:goodSnap.recoveryStrategy.totalPromotions,
  restoredVersion:restoredSnap.recoveryStrategy.version,
  unrelatedPromotions:unrelated.snapshot().recoveryStrategy.totalPromotions,
},null,2));
