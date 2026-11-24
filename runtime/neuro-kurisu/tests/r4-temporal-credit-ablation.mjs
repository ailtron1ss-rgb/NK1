import assert from 'node:assert/strict';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';

function run(lambda01){
  const a=new CanonicalTemporalCreditAuthority({gamma01:.88,lambda01,maxHorizonTicks:8});
  a.registerDecision({decisionId:'d1',tick:1,action:'explore',contextKey:'ctx-a',predicted01:.25,at:1});
  a.registerDecision({decisionId:'d2',tick:2,action:'explore',contextKey:'ctx-b',predicted01:.25,at:2});
  return a.resolveOutcome({decisionId:'d2',tick:4,reward01:.95,predictionError01:.5,verified01:1,independent01:1,autonomous01:1,at:4});
}
const normal=run(.82);
const lesion=run(0);
const nOlder=normal.assignments.find(a=>a.decisionId==='d1');
const lOlder=lesion.assignments.find(a=>a.decisionId==='d1');
assert(nOlder && lOlder);
assert(nOlder.eligibility01 > lOlder.eligibility01);
assert(Math.abs(nOlder.creditedReward01-lOlder.creditedReward01) > 1e-6);
console.log('R4_TEMPORAL_CREDIT_ABLATION_PASS', JSON.stringify({
  normalOlder:{eligibility:nOlder.eligibility01,credit:nOlder.creditedReward01},
  lesionedOlder:{eligibility:lOlder.eligibility01,credit:lOlder.creditedReward01},
  absoluteCreditDelta:Math.abs(nOlder.creditedReward01-lOlder.creditedReward01),
}));
