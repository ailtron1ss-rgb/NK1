import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const action='verify';
const context='e2|c2|u3|n2|g2|s1';
const related='e2|c2|u3|n2|g3|s1';
const unrelated='e0|c0|u0|n0|g0|s0';
const policy=new AdaptivePolicyEngine();
for (const actual of [.80,.81,.83,.82]) policy.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});

function episode(bootId,reward){
  return policy.observeRecoveryOutcome({
    bootId, contextKey:context, action, reward,
    causalConfidence01:.95, selectedExpected01:.82, alternativeExpected01:.42, counterfactualSource:'matched-simulated', matchedTrials:3, independent:true, autonomous:true,
  });
}

const before=policy.recoveryStrategyBias(context,action,.5);
assert.equal(before,0,'No recovery strategy bias before evidence');

const e1=episode('boot-a',.90);
const e2=episode('boot-b',.86);
assert.equal(e1.recorded,true);
assert.equal(e2.recorded,true);
assert.equal(policy.recoveryStrategyBias(context,action,.5),0,'Promotion must require 3 independent boots');

const duplicate=episode('boot-b',.95);
assert.equal(duplicate.recorded,true,'Repeated matched evidence may update the existing boot episode');
assert.equal(policy.snapshot().recoveryStrategy.totalEpisodes,2,'Repeated same-boot evidence must not create a third episode');

const e3=episode('boot-c',.88);
assert.equal(e3.recorded,true);
assert.equal(e3.promoted,true,'Three consistent independent episodes should promote a strategy');

const trainedBias=policy.recoveryStrategyBias(context,action,.5);
const relatedBias=policy.recoveryStrategyBias(related,action,.5);
const unrelatedBias=policy.recoveryStrategyBias(unrelated,action,.5);
assert.ok(trainedBias>0.0001,'Promoted context should change future policy');
assert.ok(relatedBias>0,'A semantically close context should receive bounded transfer');
assert.equal(unrelatedBias,0,'Unrelated context must not receive recovery transfer');

const snap=policy.snapshot();
assert.equal(snap.recoveryStrategy.totalEpisodes,3);
assert.equal(snap.recoveryStrategy.totalPromotions,1);
assert.equal(snap.recoveryStrategy.promotions[0].episodes,3);

const restored=new AdaptivePolicyEngine();
restored.restore(snap);
const restoredBias=restored.recoveryStrategyBias(context,action,.5);
assert.ok(Math.abs(restoredBias-trainedBias)<1e-12,'Promotion must survive state restore exactly');

const diagnostics=restored.recoveryStrategyDiagnostics(related);
assert.equal(diagnostics.totalPromotions,1);
assert.ok(diagnostics.transfers.some(x=>x.action===action && x.distance===1));

console.log(JSON.stringify({
  status:'PASS',
  trainedBias,
  relatedBias,
  unrelatedBias,
  restoredBias,
  episodes:snap.recoveryStrategy.totalEpisodes,
  promotions:snap.recoveryStrategy.totalPromotions,
  sourceEpisodes:snap.recoveryStrategy.promotions[0].sourceEpisodeIds.length,
},null,2));
