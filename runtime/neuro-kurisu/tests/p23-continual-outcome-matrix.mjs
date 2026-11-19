import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { buildContinualOutcomeMatrix } from '../src/organism/learning/ContinualOutcomeMatrix.ts';

const manifest = [
  { taskId:'a', family:'memory', split:'holdout', promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('old fact'), verifierId:'v1', version:'1' },
  { taskId:'b', family:'transfer', split:'holdout', promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('new context'), verifierId:'v1', version:'1' },
  { taskId:'train-only', family:'memory', split:'train', promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt('training only'), verifierId:'v1', version:'1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const add = (taskId, method, seed, passed, extra={}) => ledger.record({
  taskId, taskVersion:'1', method, seed, attempt:1, passed,
  authority:'independent-verifier', verifierId:'v1', evidenceRef:`verifier://${taskId}/${method}/${seed}`,
  observedAt:1000+seed, ...extra,
});
for (const seed of [11, 22, 33, 44]) {
  add('a','pretrain',seed,seed===11);
  add('b','pretrain',seed,seed===11 || seed===22);
  add('a','checkpoint-1',seed,seed!==44);
  add('b','checkpoint-1',seed,seed===11 || seed===22);
  add('a','checkpoint-2',seed,seed===11 || seed===22);
  add('b','checkpoint-2',seed,true);
  add('train-only','checkpoint-1',seed,true);
  add('train-only','checkpoint-2',seed,true);
}
const matrix = buildContinualOutcomeMatrix(ledger, [
  {stageId:'after-task-1',method:'checkpoint-1'},
  {stageId:'after-task-2',method:'checkpoint-2'},
], {split:'holdout', preTrainingMethod:'pretrain', referenceScore:0.25});
assert.equal(matrix.taskCount,2);
assert.equal(matrix.seedCount,4);
assert.equal(matrix.evidence.outcomeCount,24);
assert.equal(matrix.evidence.authorityCounts['independent-verifier'],24);
assert.deepEqual(matrix.evidence.seedIds,[11,22,33,44]);
assert.deepEqual(matrix.tasks.map(t=>t.taskId),['a','b']);
assert.ok(matrix.metrics.averageForwardTransfer !== null);
assert.equal(matrix.metrics.forwardTransferTaskCount,2);
assert.equal(matrix.metrics.stageCount,2);
assert.equal(matrix.cells.length,4);
assert.equal(matrix.familySummaries.length,2);
const memoryFamily = matrix.familySummaries.find(item => item.family === 'memory');
const transferFamily = matrix.familySummaries.find(item => item.family === 'transfer');
assert.equal(memoryFamily.taskCount,1);
assert.equal(memoryFamily.finalPassRate,0.5);
assert.equal(memoryFamily.averageForgetting,0.25);
assert.equal(transferFamily.finalPassRate,1);
assert.equal(transferFamily.averageForgetting,0);
const bAfterStage2 = matrix.cells.find(cell => cell.taskId === 'b' && cell.stageId === 'after-task-2');
assert.equal(bAfterStage2.sampleCount,4);
assert.equal(bAfterStage2.passedCount,4);
assert.equal(bAfterStage2.passRate,1);
assert.ok(bAfterStage2.wilson95CI[0] > 0.5 && bAfterStage2.wilson95CI[1] === 1);
const aAfterStage2 = matrix.cells.find(cell => cell.taskId === 'a' && cell.stageId === 'after-task-2');
assert.equal(aAfterStage2.passRate,0.5);
assert.ok(aAfterStage2.wilson95CI[0] < 0.5 && aAfterStage2.wilson95CI[1] > 0.5);
assert.equal(matrix.metrics.finalAverageScore,0.75);
assert.equal(matrix.metrics.averageForwardTransfer,0.125);
assert.equal(matrix.manifestFingerprint,ledger.manifestFingerprint());

assert.equal(matrix.sampleTransitions.length,2,'baseline-to-first and adjacent checkpoint transitions are reported');
const baselineToFirst=matrix.sampleTransitions.find(item=>item.fromMethod==='pretrain'&&item.toMethod==='checkpoint-1');
assert.ok(baselineToFirst);
assert.equal(baselineToFirst.sampleCount,8);
assert.equal(baselineToFirst.passedToFailed,0);
assert.equal(baselineToFirst.failedToPassed,2);
assert.equal(baselineToFirst.retainedPass,3);
assert.equal(baselineToFirst.retainedFail,3);
assert.equal(baselineToFirst.forgettingRate,0);
assert.equal(baselineToFirst.recoveryRate,2/5);
assert.equal(baselineToFirst.netTransferRate,.25);

const afterTask1To2=matrix.sampleTransitions.find(item=>item.fromStageId==='after-task-1'&&item.toStageId==='after-task-2');
assert.ok(afterTask1To2);
assert.equal(afterTask1To2.sampleCount,8);
assert.equal(afterTask1To2.passedToFailed,1,'one previously successful matched sample was forgotten');
assert.equal(afterTask1To2.failedToPassed,2,'two previously failing matched samples recovered');
assert.equal(afterTask1To2.retainedPass,4);
assert.equal(afterTask1To2.retainedFail,1);
assert.equal(afterTask1To2.forgettingRate,1/5);
assert.equal(afterTask1To2.recoveryRate,2/3);
assert.equal(afterTask1To2.netTransferRate,1/8);

const memoryTransition=matrix.familySampleTransitions.find(item=>item.family==='memory'&&item.toStageId==='after-task-2');
const transferTransition=matrix.familySampleTransitions.find(item=>item.family==='transfer'&&item.toStageId==='after-task-2');
assert.equal(memoryTransition?.passedToFailed,1);
assert.equal(memoryTransition?.failedToPassed,0);
assert.equal(transferTransition?.passedToFailed,0);
assert.equal(transferTransition?.failedToPassed,2);
const taskATransition=matrix.taskSampleTransitions.find(item=>item.taskId==='a'&&item.toStageId==='after-task-2');
assert.equal(taskATransition?.sampleCount,4);
assert.equal(taskATransition?.passedToFailed,1);
assert.equal(taskATransition?.failedToPassed,0);
assert.throws(()=>buildContinualOutcomeMatrix(ledger,[{stageId:'x',method:'checkpoint-1'},{stageId:'x',method:'checkpoint-2'}]),/duplicate stageId/);
assert.throws(()=>buildContinualOutcomeMatrix(ledger,[{stageId:'x',method:'checkpoint-1'},{stageId:'y',method:'checkpoint-1'}]),/duplicate stage method/);
assert.throws(()=>buildContinualOutcomeMatrix(ledger,[{stageId:'x',method:'checkpoint-1'}]),/stage count must equal task count/);
assert.throws(()=>buildContinualOutcomeMatrix(ledger,[{stageId:'x',method:'checkpoint-1'},{stageId:'y',method:'checkpoint-2'}],{preTrainingMethod:'checkpoint-1'}),/distinct from checkpoint methods/);
const sparse = new VerifiedOutcomeLedger(manifest);
assert.throws(()=>buildContinualOutcomeMatrix(sparse,[{stageId:'x',method:'checkpoint-1'},{stageId:'y',method:'checkpoint-2'}]),/missing outcomes/);
const uneven = new VerifiedOutcomeLedger(manifest);
for (const seed of [11,22]) {
  for (const taskId of ['a','b']) {
    uneven.record({taskId,taskVersion:'1',method:'x',seed,attempt:1,passed:true,authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://x/${taskId}/${seed}`,observedAt:1000+seed});
    if (!(taskId==='b' && seed===22)) uneven.record({taskId,taskVersion:'1',method:'y',seed,attempt:1,passed:false,authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://y/${taskId}/${seed}`,observedAt:1000+seed});
  }
}
assert.throws(()=>buildContinualOutcomeMatrix(uneven,[{stageId:'one',method:'x'},{stageId:'two',method:'y'}]),/exact same seed set/);

// Baseline must cover the same seed IDs for every holdout task; missing baseline
// evidence cannot be silently interpreted as zero forward transfer.
const missingBaseline = new VerifiedOutcomeLedger(manifest);
for (const seed of [1,2]) {
  for (const taskId of ['a','b']) {
    missingBaseline.record({taskId,taskVersion:'1',method:'stage-1',seed,attempt:1,passed:true,authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://${taskId}/stage-1/${seed}`,observedAt:2000+seed});
    missingBaseline.record({taskId,taskVersion:'1',method:'stage-2',seed,attempt:1,passed:true,authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://${taskId}/stage-2/${seed}`,observedAt:3000+seed});
    if (taskId === 'a') missingBaseline.record({taskId,taskVersion:'1',method:'baseline',seed,attempt:1,passed:true,authority:'independent-verifier',verifierId:'v1',evidenceRef:`verifier://${taskId}/baseline/${seed}`,observedAt:4000+seed});
  }
}
assert.throws(()=>buildContinualOutcomeMatrix(missingBaseline,[{stageId:'s1',method:'stage-1'},{stageId:'s2',method:'stage-2'}],{preTrainingMethod:'baseline'}),/pre-training method lacks matched seeds for task b/);
console.log('PASS continual outcome matrix: matched seeds, split isolation, baseline parity, cell-level Wilson intervals, task-family stratification');
