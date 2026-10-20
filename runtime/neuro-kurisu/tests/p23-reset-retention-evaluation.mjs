import assert from 'node:assert/strict';
import { evaluateResetRetention, evaluateResetRetentionFromLedger } from '../src/organism/learning/ResetRetentionEvaluation.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const fp = 'b'.repeat(64);
const rows = [];
const add = (arm, seed, taskId, score, family='memory', authority='independent-verifier') =>
  rows.push({arm,seed,taskId,score,family,manifestFingerprint:fp,authority,evidenceRef:`verifier://${arm}/${seed}/${taskId}`});
for (const seed of [1,2,3,4]) {
  // Two learnable tasks: one memory, one transfer. Keep P/C/R paired.
  add('P',seed,'fact-recall',0.2,'memory');
  add('C',seed,'fact-recall',0.8,'memory');
  add('R(1)',seed,'fact-recall',seed===1 ? 0.5 : 0.6,'memory');
  add('R(2)',seed,'fact-recall',0.4,'memory');
  add('P',seed,'transfer-rule',0.1,'transfer');
  add('C',seed,'transfer-rule',0.9,'transfer');
  add('R(1)',seed,'transfer-rule',0.5,'transfer');
  add('R(2)',seed,'transfer-rule',0.3,'transfer');
  // Saturated task must not distort normalized retention.
  add('P',seed,'already-known',0.8,'prior');
  add('C',seed,'already-known',0.8,'prior');
  add('R(1)',seed,'already-known',0.8,'prior');
  add('R(2)',seed,'already-known',0.8,'prior');
}
const report = evaluateResetRetention(rows,{resetEvery:[1,2]});
assert.equal(report.observationCount,48);
assert.deepEqual(report.excludedTaskIds,['already-known']);
assert.equal(report.estimates.length,2);
const r1 = report.estimates[0];
assert.equal(r1.pairedSeeds,4,'independent seed count, not task-cell count');
assert.equal(r1.eligibleTaskCount,2);
assert.equal(r1.excludedTaskCount,1);
assert.ok(Math.abs(r1.normalizedRetention - (0.5*((((0.5-0.2)/(0.8-0.2)+3*((0.6-0.2)/(0.8-0.2)))/4)+0.5))) < 1e-12);
assert.ok(r1.seedLevel95CI && r1.seedLevel95CI[0] < r1.normalizedRetention && r1.seedLevel95CI[1] > r1.normalizedRetention);
assert.equal(r1.perFamily.length,2);
assert.equal(r1.perFamily.find(x=>x.family==='transfer').taskCount,1);
assert.ok(report.estimates[1].normalizedRetention < r1.normalizedRetention,'more frequent reset should reflect lower fixture retention');
const oneSeed = evaluateResetRetention(rows.filter(x=>x.seed===1 && x.arm!=='R(2)'),{resetEvery:[1]});
assert.equal(oneSeed.estimates[0].seedLevel95CI,null,'single seed cannot support a confidence interval');
assert.throws(()=>evaluateResetRetention([...rows,rows[0]],{resetEvery:[1,2]}),/duplicate task\/seed\/arm/);
assert.throws(()=>evaluateResetRetention(rows.map((x,i)=>i===0?{...x,manifestFingerprint:'invalid'}:x),{resetEvery:[1,2]}),/manifestFingerprint/);
assert.throws(()=>evaluateResetRetention(rows.map((x,i)=>i===0?{...x,authority:'self-report'}:x),{resetEvery:[1,2]}),/independent-verifier/);
assert.throws(()=>evaluateResetRetention(rows.map((x,i)=>i===0?{...x,score:1.1}:x),{resetEvery:[1,2]}),/in \[0, 1\]/);
assert.throws(()=>evaluateResetRetention(rows.filter(x=>!(x.taskId==='fact-recall'&&x.seed===2&&x.arm==='R(1)')),{resetEvery:[1,2]}),/incomplete matched arms/);
assert.throws(()=>evaluateResetRetention(rows,{resetEvery:[1,1]}),/distinct positive/);

const manifest = [
  {taskId:'fact-recall',family:'memory',split:'holdout',promptFingerprint:'c'.repeat(64),verifierId:'v1',version:'1'},
  {taskId:'transfer-rule',family:'transfer',split:'holdout',promptFingerprint:'d'.repeat(64),verifierId:'v1',version:'1'},
  {taskId:'train-only',family:'memory',split:'train',promptFingerprint:'e'.repeat(64),verifierId:'v1',version:'1'},
];
const ledger = new VerifiedOutcomeLedger(manifest);
const record = (taskId, method, seed, passed) => {
  const result = ledger.record({taskId,taskVersion:'1',method,seed,attempt:1,passed,
    authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://${taskId}/${method}/${seed}`,observedAt:1000+seed});
  assert.equal(result.accepted,true);
};
for (const seed of [1,2,3,4]) {
  for (const taskId of ['fact-recall','transfer-rule']) {
    record(taskId,'prior',seed,false);
    record(taskId,'continuous',seed,true);
    record(taskId,'reset-1',seed,taskId==='fact-recall' ? seed!==1 : true);
    record(taskId,'reset-2',seed,seed===1);
  }
  // Train-only outcomes must never enter holdout evaluation.
  record('train-only','prior',seed,false);
  record('train-only','continuous',seed,true);
  record('train-only','reset-1',seed,true);
  record('train-only','reset-2',seed,true);
}
const fromLedger = evaluateResetRetentionFromLedger(ledger,{
  priorMethod:'prior',ceilingMethod:'continuous',resetMethods:{1:'reset-1',2:'reset-2'},split:'holdout',
});
assert.equal(fromLedger.observationCount,32,'adapter should project only two holdout tasks, four seeds and four arms');
assert.equal(fromLedger.estimates[0].eligibleTaskCount,2);
assert.equal(fromLedger.estimates[0].pairedSeeds,4);
assert.equal(fromLedger.manifestFingerprint,ledger.manifestFingerprint());
assert.ok(fromLedger.estimates[0].normalizedRetention !== null);
assert.throws(()=>evaluateResetRetentionFromLedger(ledger,{
  priorMethod:'prior',ceilingMethod:'prior',resetMethods:{1:'reset-1'},
}),/distinct non-empty methods/);

console.log('PASS reset retention: matched P/C/R(k), seed-level CI, saturated-task exclusion, family strata and evidence validation');
