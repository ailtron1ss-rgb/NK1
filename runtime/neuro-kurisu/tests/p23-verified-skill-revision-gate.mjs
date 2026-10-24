import assert from 'node:assert/strict';
import { evaluateSkillRevision } from '../src/organism/learning/SkillRevisionGate.ts';
const rows = [];
const add = (taskId, family, method, passed, seed=1, authority='independent-verifier') => rows.push({
  taskId, family, split:'holdout', method, seed, attempt:1, passed, authority,
  verifierId:'verifier-v1', expectedVerifierId:'verifier-v1', evidenceRef:`artifact://${taskId}/${method}`
});
for (let i=0;i<10;i++) {
  add(`task-${i}`, i<5?'memory':'tool-use', 'baseline', i<6);
  add(`task-${i}`, i<5?'memory':'tool-use', 'candidate', i<8);
}
let result = evaluateSkillRevision(rows, 'baseline', 'candidate', {minPairedTasks:8,minAbsoluteGain:.1});
assert.equal(result.pairedN,10);
assert.equal(result.accepted,true);
assert.equal(result.reason,'heldout-gate-passed-proposal-only');
assert.ok(result.absoluteGain >= .1);
// Self-report must never enter the gate.
const forged = [...rows, {...rows[0], method:'candidate', taskId:'forged', authority:'self-report', evidenceRef:'artifact://self'}];
result = evaluateSkillRevision(forged, 'baseline', 'candidate', {minPairedTasks:8,minAbsoluteGain:.1});
assert.ok(result.rejectedRows >= 1);
// A method that regresses badly on one sufficiently sampled family is blocked.
const regressed = [];
for (let i=0;i<10;i++) {
  const family = i<5?'memory':'tool-use';
  regressed.push({taskId:`r-${i}`,family,split:'holdout',method:'baseline',seed:1,attempt:1,passed:true,authority:'human-review',verifierId:'human',expectedVerifierId:'v',evidenceRef:`b-${i}`});
  regressed.push({taskId:`r-${i}`,family,split:'holdout',method:'candidate',seed:1,attempt:1,passed:i<5,authority:'human-review',verifierId:'human',expectedVerifierId:'v',evidenceRef:`c-${i}`});
}
result = evaluateSkillRevision(regressed,'baseline','candidate',{minPairedTasks:8,minAbsoluteGain:0,maxFamilyRegression:.1});
assert.equal(result.accepted,false);
assert.equal(result.reason,'heldout-family-regression');
// Replaying the same verifier receipt under a new task ID must not inflate the independent holdout sample.
const replayed = [...rows,
  { ...rows[0], taskId: 'replayed-task', evidenceRef: rows[0].evidenceRef },
  { ...rows[1], taskId: 'replayed-task', evidenceRef: rows[1].evidenceRef },
];
result = evaluateSkillRevision(replayed, 'baseline', 'candidate', {minPairedTasks:8,minAbsoluteGain:.1});
assert.equal(result.pairedN, 10, 'reused verifier receipts must not create an eleventh independent pair');
assert.ok(result.rejectedRows >= 2, 'both replayed method receipts should be rejected');
// One verifier receipt cannot be reused to certify both sides of the same comparison.
const sharedReceipt = [
  { ...rows[0], taskId: 'shared-receipt-task', method: 'baseline', evidenceRef: 'artifact://shared-receipt' },
  { ...rows[1], taskId: 'shared-receipt-task', method: 'candidate', evidenceRef: 'artifact://shared-receipt' },
];
result = evaluateSkillRevision(sharedReceipt, 'baseline', 'candidate', {minPairedTasks:2,minAbsoluteGain:0});
assert.equal(result.pairedN, 0, 'a single receipt must not attest to both baseline and candidate');
assert.ok(result.rejectedRows >= 1, 'the reused receipt must be rejected');

// Validation/train observations are deliberately excluded.
result = evaluateSkillRevision(rows.map(x=>({...x,split:'train'})),'baseline','candidate');
assert.equal(result.pairedN,0);
console.log('P23_VERIFIED_SKILL_REVISION_GATE=PASS');
