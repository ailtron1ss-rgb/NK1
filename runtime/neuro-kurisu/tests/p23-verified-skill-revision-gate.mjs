import assert from 'node:assert/strict';
import { evaluateSkillRevision } from '../src/organism/learning/SkillRevisionGate.ts';
const rows = [];
const add = (taskId, family, method, passed, seed=1, authority='independent-verifier', taskVersion='v1') => rows.push({
  taskId, taskVersion, family, split:'holdout', method, seed, attempt:1, passed, authority,
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
  regressed.push({taskId:`r-${i}`,taskVersion:'v1',family,split:'holdout',method:'baseline',seed:1,attempt:1,passed:true,authority:'human-review',verifierId:'human',expectedVerifierId:'v',evidenceRef:`b-${i}`});
  regressed.push({taskId:`r-${i}`,taskVersion:'v1',family,split:'holdout',method:'candidate',seed:1,attempt:1,passed:i<5,authority:'human-review',verifierId:'human',expectedVerifierId:'v',evidenceRef:`c-${i}`});
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
assert.equal(result.pairedN, 9, 'all colliding original/replayed receipts must be excluded independent of row order');
assert.ok(result.rejectedRows >= 4, 'every copy of each duplicated method receipt should be rejected');

// The same task ID can be re-used after its manifest/prompt version changes.
// Baseline v1 must never pair with candidate v2.
const versionMixed = rows.map(row => row.taskId === 'task-0' && row.method === 'candidate'
  ? {...row, taskVersion:'v2'}
  : row);
result = evaluateSkillRevision(versionMixed, 'baseline', 'candidate');
assert.equal(result.pairedN, 9, 'cross-version task identity must not contribute a paired sample');
assert.equal(result.accepted, true, 'the remaining nine valid task/version pairs remain independently sufficient');

// One evidence reference cannot represent both the baseline and candidate method.
// The duplicate is rejected before it can create a matched pair.
const sharedReceipt = rows.map(row => row.taskId === 'task-0' && row.method === 'candidate'
  ? {...row, evidenceRef: 'artifact://task-0/baseline'}
  : row);
result = evaluateSkillRevision(sharedReceipt, 'baseline', 'candidate');
assert.equal(result.pairedN, 9, 'one receipt cannot be counted for both methods');
assert.ok(result.rejectedRows >= 2, 'every row using the colliding cross-method receipt must be rejected');
// Validation/train observations are deliberately excluded.
result = evaluateSkillRevision(rows.map(x=>({...x,split:'train'})),'baseline','candidate');
assert.equal(result.pairedN,0);

// Runtime payloads are not trusted just because the TypeScript API has a static type.
// Malformed rows must be rejected individually, never crash evaluation or add sample size.
const malformedRows = [
  null,
  {},
  {...rows[0], taskId: 42},
  {...rows[0], taskVersion: null},
  {...rows[0], family: {label:'memory'}},
  {...rows[0], method: ['candidate']},
  {...rows[0], verifierId: {trim: 'not-a-function'}},
  {...rows[0], expectedVerifierId: null},
  {...rows[0], evidenceRef: 'bad' + String.fromCharCode(10) + 'receipt'},
  {...rows[0], taskId: 'task-with-' + String.fromCharCode(0) + '-control'},
  {...rows[0], taskId: 'Ｔａｓｋ－ａｌｉａｓ－１'},
  {...rows[0], seed: Number.POSITIVE_INFINITY},
  new Proxy(rows[0], { getPrototypeOf() { throw new Error('untrusted proxy trap'); } }),
  Object.defineProperty({...rows[0]}, 'taskId', { get() { throw new Error('untrusted getter'); } }),
];
result = evaluateSkillRevision([...rows, ...malformedRows], 'baseline', 'candidate');
assert.equal(result.accepted, true, 'invalid extra rows must not alter a valid independent comparison');
assert.equal(result.pairedN, 10);
assert.equal(result.rejectedRows, malformedRows.length);
assert.throws(() => evaluateSkillRevision(null, 'baseline', 'candidate'), /observations must be an array/);
assert.throws(() => evaluateSkillRevision(rows, {}, 'candidate'), /bounded method names/);
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', null), /options must be a plain data object/);
const throwingOption = Object.defineProperty({}, 'minPairedTasks', { get() { throw new Error('untrusted option getter'); } });
assert.throws(() => evaluateSkillRevision(rows, 'baseline', 'candidate', throwingOption), /options must be a plain data object/);

console.log('P23_VERIFIED_SKILL_REVISION_GATE=PASS');
