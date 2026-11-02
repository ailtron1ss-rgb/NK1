import assert from 'node:assert/strict';
import { AdaptiveReplayGovernor } from '../src/organism/system/AdaptiveReplayGovernor.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const governor=new AdaptiveReplayGovernor();
const node={
  id:'feedback-memory',
  kind:'episodic',
  ageMs:30*86400000,
  lastReplayedAt:0,
  replayCount:0,
  surprise01:.96,
  decayNeed01:.92,
  transferPotential01:.91,
  identity01:.88,
  goal01:.9,
  novelty01:.9,
  stability01:.92,
  interference01:.05,
  activeGoalMatch:true,
  clusterKey:'feedback-memory-cluster',
};
const plan=governor.plan({
  tick:4,
  at:1_800_000_000_000,
  pressure01:.78,
  energy01:.9,
  memoryPressure01:.15,
  mobile:false,
  activeGoalIds:['goal-feedback'],
  nodes:[node],
});
assert.equal(plan.due,true);
assert.equal(plan.candidates.length,1);
const candidate=plan.candidates[0];
const before=governor.snapshot().policyWeights;

// A caller boolean must not alter learned policy weights.
const forged=governor.feedback({
  memoryId:candidate.id,
  retentionGain01:.9,
  transferPotential01:.9,
  interferenceRisk01:.02,
  independentVerified:true,
  delayMs:7*86400000,
});
assert.equal(forged.updated,false,
  'caller-controlled independentVerified must not authorize policy adaptation');
assert.deepEqual(governor.snapshot().policyWeights,before,
  'unverified feedback must not mutate replay policy weights');

// The process-local verifier receipt is bound to the exact feedback tuple.
const input={
  memoryId:candidate.id,
  retentionGain01:.9,
  transferPotential01:.9,
  interferenceRisk01:.02,
  delayMs:7*86400000,
};
const verifier=new OutcomeVerificationService();
const verification=await verifier.verify({
  toolId:'p2687-independent-replay-policy-verifier',
  input,
  result:{ok:true,measurementId:'policy-feedback-1'},
},()=>({
  verified:true,
  basis:'external-postcondition',
  confidence01:1,
  externalObservation:true,
  observationId:'policy-feedback-observation-1',
  expectedPostcondition:'delayed replay policy utility independently measured',
  observedPostcondition:'delayed replay policy utility independently measured',
}));
const accepted=governor.feedback({...input,verification,verificationInput:input});
assert.equal(accepted.updated,true,
  'a verifier-minted exact receipt must enable policy adaptation');
assert.notDeepEqual(governor.snapshot().policyWeights,before,
  'authenticated feedback must update bounded policy weights');

// Neither copying the receipt nor mutating the tuple may authorize another update.
const afterAccepted=governor.snapshot().policyWeights;
const copied=governor.feedback({
  ...input,
  verification:{...verification},
  verificationInput:input,
});
assert.equal(copied.updated,false,'a copied JSON receipt loses process-local authority');
assert.deepEqual(governor.snapshot().policyWeights,afterAccepted);

const alteredInput={...input,transferPotential01:.99};
const altered=governor.feedback({
  ...alteredInput,
  verification,
  verificationInput:alteredInput,
});
assert.equal(altered.updated,false,'a valid receipt cannot be rebound to changed transfer evidence');
assert.deepEqual(governor.snapshot().policyWeights,afterAccepted);

console.log('ADAPTIVE_REPLAY_FEEDBACK_AUTHORITY=PASS');
