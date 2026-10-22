import assert from 'node:assert/strict';
import { ContinualForgettingTracker } from '../src/organism/learning/ContinualForgettingTracker.ts';

const tracker = new ContinualForgettingTracker();
assert.deepEqual(tracker.result(), {
  taskCount: 0, meanForgetting01: 0, maxForgetting01: 0, tasks: [],
});

tracker.record('task-b', 0.4);
tracker.record('task-a', 0.8);
const declined = tracker.record('task-a', 0.55);
assert.equal(declined.bestScore01, 0.8);
assert.equal(declined.latestScore01, 0.55);
assert.ok(Math.abs(declined.forgetting01 - 0.25) < 1e-12);
assert.equal(declined.observations, 2);

const improved = tracker.record('task-a', 0.9);
assert.equal(improved.bestScore01, 0.9);
assert.equal(improved.latestScore01, 0.9);
assert.equal(improved.forgetting01, 0);

const summary = tracker.result();
assert.equal(summary.taskCount, 2);
assert.equal(summary.tasks[0].taskId, 'task-a');
assert.equal(summary.tasks[1].taskId, 'task-b');
assert.ok(Math.abs(summary.meanForgetting01 - 0) < 1e-12);

const snapshot = tracker.snapshot();
const restored = new ContinualForgettingTracker();
restored.restore(snapshot);
assert.deepEqual(restored.result(), summary);
restored.record('task-b', 0.1);
assert.ok(Math.abs(restored.result().maxForgetting01 - 0.3) < 1e-12);

assert.throws(() => tracker.record('', 0.5), /forgetting-task-id-required/);
assert.throws(() => tracker.record('task-c', NaN), /forgetting-score-out-of-range/);
assert.throws(() => tracker.record('task-c', 1.1), /forgetting-score-out-of-range/);
assert.throws(() => restored.restore({ tasks: [{ taskId: 'x', bestScore01: 0.2, latestScore01: 0.3, observations: 1 }] }), /forgetting-snapshot-entry-invalid/);

tracker.clear();
assert.equal(tracker.result().taskCount, 0);
console.log('P26_CONTINUAL_FORGETTING_TRACKER=PASS');
