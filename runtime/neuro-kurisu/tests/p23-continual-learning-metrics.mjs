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
assert.ok(Math.abs(result.averageBackwardTransfer - ((0.5 - 0.8) + (0.85 - 0.9) + (0.95 - 0.2)) / 3) < 1e-12);
assert.ok(Math.abs(result.averageForwardTransfer - ((0.2 - 0.25) + (0.3 - 0.25) + (0.1 - 0.25)) / 3) < 1e-12);
assert.equal(result.forwardTransferTaskCount, 3);
assert.equal(evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5] }]).averageForwardTransfer, null);
assert.throws(() => evaluateContinualLearning([]), /at least one task/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5] }, { taskId: 'x', scoreByStage: [0.5] }]), /duplicate taskId/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [0.5, 0.6] }]), /one stage per task/);
assert.throws(() => evaluateContinualLearning([{ taskId: 'x', scoreByStage: [1.2] }]), /in \[0, 1\]/);
console.log('PASS continual-learning metrics: final score, forgetting, backward/forward transfer, validation');
