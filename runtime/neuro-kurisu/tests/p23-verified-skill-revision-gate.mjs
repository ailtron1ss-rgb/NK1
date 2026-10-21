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
// Validation/train observations are deliberately excluded.
result = evaluateSkillRevision(rows.map(x=>({...x,split:'train'})),'baseline','candidate');
assert.equal(result.pairedN,0);
console.log('P23_VERIFIED_SKILL_REVISION_GATE=PASS');
