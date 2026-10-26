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

// Malformed persisted/runtime fields are rejected as rows instead of crashing string/normalization calls.
const malformedRows = [
  { ...rows[0], taskId: 17 },
  { ...rows[1], family: {} },
  { ...rows[2], method: ['candidate'] },
  { ...rows[3], verifierId: 9 },
  { ...rows[4], evidenceRef: null },
  { ...rows[5], seed: '1' },
  { ...rows[6], split: 1 },
];
result = evaluateSkillRevision([...rows, ...malformedRows], 'baseline', 'candidate', {
  minPairedTasks: 8, minAbsoluteGain: .1,
});
assert.equal(result.pairedN, 10, 'malformed rows must not disturb valid matched task pairs');
assert.ok(result.rejectedRows >= malformedRows.length,
  'every malformed row must be rejected before string/normalization methods are called');

// Cross-family rows are not a valid paired sample and must be counted as rejected evidence.
const mismatchedFamilyPair = [
  { ...rows[0], taskId: 'mismatch-family-task', family: 'memory', method: 'baseline',
    evidenceRef: 'artifact://mismatch-family/baseline' },
  { ...rows[1], taskId: 'mismatch-family-task', family: 'tool-use', method: 'candidate',
    evidenceRef: 'artifact://mismatch-family/candidate' },
];
result = evaluateSkillRevision([...rows, ...mismatchedFamilyPair], 'baseline', 'candidate', {
  minPairedTasks: 8, minAbsoluteGain: .1,
});
assert.equal(result.pairedN, 10, 'cross-family rows must not enter the matched holdout denominator');
assert.equal(result.rejectedRows, 1, 'the cross-family pair must count as one rejected pair');

assert.throws(() => evaluateSkillRevision(null, 'baseline', 'candidate'),
  /revision observations must be an array/);
assert.throws(() => evaluateSkillRevision(rows, 7, 'candidate'),
  /two distinct method names are required/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', null),
  /skill revision gate options must be an object/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', { minPairedTasks: 1 }),
  /minPairedTasks must be an integer from 2 to 10000/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', { minPairedTasks: 2.5 }),
  /minPairedTasks must be an integer from 2 to 10000/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', { minAbsoluteGain: Number.NaN }),
  /minAbsoluteGain must be a finite number from 0 to 1/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', { minAbsoluteGain: -0.01 }),
  /minAbsoluteGain must be a finite number from 0 to 1/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', { maxFamilyRegression: 1.01 }),
  /maxFamilyRegression must be a finite number from 0 to 1/);

// Validation/train observations are deliberately excluded.
result = evaluateSkillRevision(rows.map(x=>({...x,split:'train'})),'baseline','candidate');
assert.equal(result.pairedN,0);
console.log('P23_VERIFIED_SKILL_REVISION_GATE=PASS');
