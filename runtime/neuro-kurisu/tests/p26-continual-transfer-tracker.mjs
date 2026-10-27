import assert from 'node:assert/strict';
import { ContinualTransferTracker } from '../src/organism/learning/ContinualTransferTracker.ts';

const tracker = new ContinualTransferTracker();
assert.deepEqual(tracker.result(), {
  taskCount: 0,
  measuredForwardTransferTasks: 0,
  measuredBackwardTransferTasks: 0,
  meanForwardTransfer01: null,
  meanBackwardTransfer01: null,
  tasks: [],
});

// Prior tasks improved performance on task-a from its independent baseline
// before it was explicitly trained; subsequent training later improved it again.
tracker.recordBaseline('task-a', 0.2, 0);
const before = tracker.recordBeforeTaskTraining('task-a', 0.35, 2);
assert.ok(Math.abs(before.forwardTransfer01 - 0.15) < 1e-12, 'forward-transfer delta tolerates normal IEEE-754 rounding');
assert.equal(before.backwardTransfer01, null);
const first = tracker.recordAfterTaskTraining('task-a', 0.6, 3);
assert.equal(first.firstPostTrainingScore01, 0.6);
assert.equal(first.backwardTransfer01, 0);
const later = tracker.recordAfterTaskTraining('task-a', 0.8, 5);
assert.ok(Math.abs(later.backwardTransfer01 - 0.2) < 1e-12);

// Negative transfer and regression are retained as signed values, not clamped.
tracker.recordBaseline('task-b', 0.4, 0);
tracker.recordBeforeTaskTraining('task-b', 0.3, 5);
tracker.recordAfterTaskTraining('task-b', 0.5, 6);
const degraded = tracker.recordAfterTaskTraining('task-b', 0.25, 8);
assert.ok(Math.abs(degraded.forwardTransfer01 - (-0.1)) < 1e-12);
assert.ok(Math.abs(degraded.backwardTransfer01 - (-0.25)) < 1e-12);

const result = tracker.result();
assert.equal(result.taskCount, 2);
assert.equal(result.measuredForwardTransferTasks, 2);
assert.equal(result.measuredBackwardTransferTasks, 2);
assert.ok(Math.abs(result.meanForwardTransfer01 - 0.025) < 1e-12);
assert.ok(Math.abs(result.meanBackwardTransfer01 - (-0.025)) < 1e-12);
assert.deepEqual(result.tasks.map((t) => t.taskId), ['task-a', 'task-b']);

const restored = new ContinualTransferTracker();
restored.restore(tracker.snapshot());
assert.deepEqual(restored.result(), result);
restored.recordAfterTaskTraining('task-a', 0.7, 6);
assert.ok(Math.abs(restored.result().tasks[0].backwardTransfer01 - 0.1) < 1e-12);

assert.throws(() => tracker.recordBaseline('task-c', NaN), /transfer-score-out-of-range/);
assert.throws(() => tracker.recordBaseline('', 0.2), /transfer-task-id-required/);
assert.throws(() => tracker.recordBeforeTaskTraining('missing', 0.3, 1), /transfer-baseline-required-first/);
assert.throws(() => tracker.recordAfterTaskTraining('task-a', 0.4, 4), /transfer-stage-must-be-monotonic/);
assert.throws(() => tracker.recordBaseline('task-a', 0.1), /transfer-baseline-already-recorded/);
assert.throws(() => restored.restore({ tasks: [{ taskId: 'x', observations: [{ stage: 1, phase: 'after-task-training', score01: 0.5 }] }] }), /transfer-snapshot-posttraining-invalid/);

tracker.clear();
assert.equal(tracker.result().taskCount, 0);
console.log('P26_CONTINUAL_TRANSFER_TRACKER=PASS');
