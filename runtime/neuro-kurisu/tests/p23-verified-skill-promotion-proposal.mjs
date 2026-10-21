import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { evaluateSkillRevision } from '../src/organism/learning/SkillRevisionGate.ts';

const manifest = Array.from({length:10},(_,i)=>({
  taskId:'task-'+i, family:i<5?'memory':'tool-use', split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('unique prompt '+i),
  verifierId:'verifier-v1', version:'v1',
}));
const ledger = new VerifiedOutcomeLedger(manifest);
for (let seed=1;seed<=5;seed++) for (let i=0;i<10;i++) {
  for (const [method,passed] of [['baseline',i<6],['candidate',i<8]]) {
    const result=ledger.record({
      taskId:'task-'+i,taskVersion:'v1',method,seed,attempt:1,passed,
      authority:'independent-verifier',verifierId:'verifier-v1',
      evidenceRef:'evidence://'+i+'/'+method+'/'+seed,observedAt:Date.now(),
    });
    assert.equal(result.accepted,true);
  }
}
const proposal=proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3});
assert.equal(proposal.gate.accepted,true);
assert.equal(proposal.gate.pairedN,50, 'pairedN counts task × seed pairs, not unique tasks');
assert.equal(proposal.pairedTaskSeedN,50);
assert.equal(proposal.uniquePairedTasks,10);
assert.equal(proposal.completePairedSeeds,5);
assert.equal(proposal.seedClusteredEvaluation.pairedN,5);
assert.ok(proposal.seedClusteredEvaluation.approximate95CI[0] > 0);
assert.equal(proposal.familyEvaluation.length,2);
assert.equal(proposal.canActivateAutomatically,false);
assert.match(proposal.proposalId,/^[a-f0-9]{64}$/);
assert.ok(proposal.activationRequirements.length>=3);
assert.equal(proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3}).proposalId,proposal.proposalId,
  'proposal identity is stable for an unchanged manifest/outcome ledger');

// Non-finite thresholds must not turn minimum paired-task requirements into NaN bypasses.
const tinyObservations = [];
for (let i=0;i<2;i++) for (const [method,passed] of [['baseline',false],['candidate',true]]) {
  tinyObservations.push({taskId:'tiny-'+i,family:'memory',split:'holdout',method,seed:1,attempt:1,passed,
    authority:'independent-verifier',verifierId:'v',expectedVerifierId:'v',evidenceRef:'e-'+i+'-'+method});
}
const nanThreshold = evaluateSkillRevision(tinyObservations,'baseline','candidate',{minPairedTasks:Number.NaN});
assert.equal(nanThreshold.accepted,false);
assert.equal(nanThreshold.reason,'insufficient-independent-heldout-pairs');

// An incomplete seed must not be counted as a complete paired evaluation.
const incomplete = new VerifiedOutcomeLedger(manifest);
for (let i=0;i<10;i++) {
  incomplete.record({taskId:'task-'+i,taskVersion:'v1',method:'baseline',seed:2,attempt:1,passed:true,
    authority:'independent-verifier',verifierId:'verifier-v1',evidenceRef:'b-'+i,observedAt:Date.now()});
}
for (let i=0;i<8;i++) incomplete.record({taskId:'task-'+i,taskVersion:'v1',method:'candidate',seed:2,attempt:1,passed:true,
  authority:'independent-verifier',verifierId:'verifier-v1',evidenceRef:'c-'+i,observedAt:Date.now()});
const blocked=proposeVerifiedSkillPromotion(incomplete,'baseline','candidate',{minPairedTasks:8,minCompleteSeeds:3});
assert.equal(blocked.gate.accepted,false);
assert.equal(blocked.gate.reason,'insufficient-complete-holdout-seed-coverage');

// Repeating seeds on a tiny set of tasks must not masquerade as broad task coverage.
const narrow = new VerifiedOutcomeLedger(manifest);
for (let seed=0;seed<10;seed++) for (let i=0;i<2;i++) for (const method of ['baseline','candidate']) {
  narrow.record({taskId:'task-'+i,taskVersion:'v1',method,seed,attempt:1,passed:method==='candidate',
    authority:'independent-verifier',verifierId:'verifier-v1',evidenceRef:'narrow-'+seed+'-'+i+'-'+method,observedAt:Date.now()});
}
const narrowProposal=proposeVerifiedSkillPromotion(narrow,'baseline','candidate',{minPairedTasks:8,minCompleteSeeds:1});
assert.equal(narrowProposal.gate.accepted,false);
assert.equal(narrowProposal.uniquePairedTasks,2);
assert.equal(narrowProposal.gate.reason,'insufficient-independent-heldout-task-coverage');

console.log('P23_VERIFIED_SKILL_PROMOTION_PROPOSAL=PASS');
