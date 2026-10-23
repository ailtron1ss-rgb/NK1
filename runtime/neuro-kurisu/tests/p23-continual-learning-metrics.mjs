import assert from 'node:assert/strict';
import { evaluateContinualLearning } from '../src/organism/learning/ContinualLearningMetrics.ts';
const result = evaluateContinualLearning([
  { taskId: 'old-a', preTrainingScore: 0.2, scoreByStage: [0.8, 0.7, 0.5] },
  { taskId: 'mid-b', preTrainingScore: 0.3, scoreByStage: [0.4, 0.9, 0.85] },
  { taskId: 'new-c', preTrainingScore: 0.1, scoreByStage: [0.2, 0.3, 0.95] },
], 0.25);
assert.equal(result.taskCount, 3);
assert.equal(result.stageCount, 3);
assert.ok(Math.abs(result.finalAverageScore - (0.5 + 0.85 + 0.95) / 3) < 1e-12);
assert.ok(Math.abs(result.averageForgetting - ((0.8 - 0.5) + (0.9 - 0.85) + 0) / 3) < 1e-12);
assert.ok(Math.abs(result.averageBackwardTransfer - ((0.5 - 0.8) + (0.85 - 0.9) + (0.95 - 0.95)) / 3) < 1e-12);
assert.ok(Math.abs(result.averageForwardTransfer - ((0.2 - 0.25) + (0.3 - 0.25) + (0.1 - 0.25)) / 3) < 1e-12);
assert.equal(result.forwardTransferTaskCount, 3);
assert.equal(evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5] }]).averageForwardTransfer, null);
assert.deepEqual(result.learningCurve01, [
  (0.8 + 0.4 + 0.2) / 3,
  (0.7 + 0.9 + 0.3) / 3,
  (0.5 + 0.85 + 0.95) / 3,
]);
assert.ok(Math.abs(result.normalizedAreaUnderLearningCurve01 - 0.625) < 1e-12,
  'area under a transient multi-stage learning curve must reflect intermediate performance, not only the endpoint');
assert.ok(Math.abs(result.netLearningGain01 - 0.3) < 1e-12,
  'net measured learning gain is final minus first checkpoint, not a causal attribution');
const singleStage = evaluateContinualLearning([{ taskId: 'single', scoreByStage: [0.7] }]);
assert.equal(singleStage.normalizedAreaUnderLearningCurve01, 0.7,
  'single-checkpoint area is defined as the measured score, without division by zero');
assert.equal(singleStage.learningCurve01.length, 1);
assert.throws(() => evaluateContinualLearning([]), /at least one task/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5, 0.5] }, { taskId: 'x', scoreByStage: [0.5, 0.5] }]), /duplicate taskId/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5, 0.6] }]), /one stage per task/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [1.2] }]), /in \[0, 1\]/);
// Forward transfer needs an explicit measured reference; omitted setup must not look like zero-baseline uplift.
assert.throws(() => evaluateContinualLearning([
  { taskId: 'a', preTrainingScore: .5, scoreByStage: [.6] },
]), /referenceScore is required/);
assert.throws(() => evaluateContinualLearning([
  { taskId: 'a', preTrainingScore: .5, scoreByStage: [.6] },
], Number.NaN), /referenceScore must be a finite number/);
// Sparse arrays are malformed evidence, not omitted cases that may be silently skipped.
const sparseTasks = new Array(1);
assert.throws(() => evaluateContinualLearning(sparseTasks), /empty slot at index 0/);
const sparseStages = new Array(1);
assert.throws(() => evaluateContinualLearning([{ taskId: 'sparse', scoreByStage: sparseStages }]), /empty slot/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'bad\u0000id', scoreByStage: [.5] }]), /valid non-empty taskId/);

let metricGetterCalls=0;
const getterTask=Object.defineProperty({taskId:'getter-task',scoreByStage:[.5]},'preTrainingScore',{
  enumerable:true,get(){metricGetterCalls++;return .4;},
});
assert.throws(()=>evaluateContinualLearning([getterTask]),/continual learning input data-boundary rejected/);
assert.equal(metricGetterCalls,0,'continual-learning metrics must snapshot task data before invoking any property getter');
assert.throws(()=>evaluateContinualLearning([{taskId:'bad-score',scoreByStage:[Number.NaN]}]),/finite numbers in \\[0, 1\\]/,
  'non-finite recorded metrics must be rejected at the trust boundary');

console.log('PASS continual-learning metrics: final score, forgetting, backward/forward transfer, validation');
