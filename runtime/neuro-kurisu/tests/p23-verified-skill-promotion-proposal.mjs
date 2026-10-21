import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';

const manifest = Array.from({length:10},(_,i)=>({
  taskId:'task-'+i, family:i<5?'memory':'tool-use', split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('unique prompt '+i),
  verifierId:'verifier-v1', version:'v1',
}));
const ledger = new VerifiedOutcomeLedger(manifest);
for (let i=0;i<10;i++) {
  for (const [method,passed] of [['baseline',i<6],['candidate',i<8]]) {
    const result=ledger.record({
      taskId:'task-'+i,taskVersion:'v1',method,seed:1,attempt:1,passed,
      authority:'independent-verifier',verifierId:'verifier-v1',
      evidenceRef:'evidence://'+i+'/'+method,observedAt:Date.now(),
    });
    assert.equal(result.accepted,true);
  }
}
const proposal=proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1});
assert.equal(proposal.gate.accepted,true);
assert.equal(proposal.gate.pairedN,10);
assert.equal(proposal.completePairedSeeds,1);
assert.equal(proposal.canActivateAutomatically,false);
assert.match(proposal.proposalId,/^[a-f0-9]{64}$/);
assert.ok(proposal.activationRequirements.length>=3);

// An incomplete seed must not be counted as a complete paired evaluation.
const incomplete = new VerifiedOutcomeLedger(manifest);
for (let i=0;i<10;i++) {
  incomplete.record({taskId:'task-'+i,taskVersion:'v1',method:'baseline',seed:2,attempt:1,passed:true,
    authority:'independent-verifier',verifierId:'verifier-v1',evidenceRef:'b-'+i,observedAt:Date.now()});
}
incomplete.record({taskId:'task-0',taskVersion:'v1',method:'candidate',seed:2,attempt:1,passed:true,
  authority:'independent-verifier',verifierId:'verifier-v1',evidenceRef:'c-0',observedAt:Date.now()});
const blocked=proposeVerifiedSkillPromotion(incomplete,'baseline','candidate',{minPairedTasks:8,minCompleteSeeds:1});
assert.equal(blocked.gate.accepted,false);
assert.equal(blocked.gate.reason,'insufficient-complete-holdout-seed-coverage');
console.log('P23_VERIFIED_SKILL_PROMOTION_PROPOSAL=PASS');
