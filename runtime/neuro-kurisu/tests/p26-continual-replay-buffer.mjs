import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';
import { ContinualReplayBuffer, trainWithExperienceReplay } from '../src/organism/learning/ContinualReplayBuffer.ts';

const exp = (taskId, feature, target01 = .9) => ({
  taskId, features: [feature, 0, 0], action: 'respond', target01, learningRate01: .12,
});
let randomCall = 0;
const rng = () => ((randomCall++ * 17) % 97) / 97;
const buffer = new ContinualReplayBuffer(6, undefined, rng);

// Bounded reservoir: memory cannot grow beyond capacity, but total exposure is tracked.
buffer.addMany([exp('A', 1), exp('A', 1), exp('A', 1), exp('B', 0), exp('B', 0), exp('C', 1), exp('C', 0)]);
assert.equal(buffer.size, 6);
assert.equal(buffer.seenCount, 7);
assert.ok(Object.values(buffer.taskCounts()).reduce((a, b) => a + b, 0) === 6);

// Balanced sampling spreads a small batch across task families when possible.
const sampled = buffer.sampleBalanced(3);
assert.equal(sampled.length, 3);
assert.equal(new Set(sampled.map((item) => item.taskId)).size, 3);

// Returned records are detached copies, so callers cannot mutate stored memory.
sampled[0].features[0] = 123;
assert.ok(buffer.snapshot().items.every((item) => item.features[0] !== 123));

// Invalid intake is rejected atomically.
const beforeInvalid = buffer.snapshot();
assert.throws(() => buffer.addMany([exp('D', 1), { ...exp('E', 1), target01: NaN }]), /target-out-of-range/);
assert.deepEqual(buffer.snapshot(), beforeInvalid);

// Snapshot restore preserves bounded memory and rejects incompatible/corrupt snapshots.
const restored = new ContinualReplayBuffer(6, undefined, rng);
restored.restore(buffer.snapshot());
assert.deepEqual(restored.snapshot(), buffer.snapshot());
assert.throws(() => restored.restore({ version: 1, capacity: 6, seenCount: 0, items: [exp('A', 1)] }), /snapshot-invalid/);

// The training adapter consumes old experiences before appending the current batch.
const learner = new ParametricPolicyLearner();
const report = trainWithExperienceReplay(learner, restored, [exp('NEW_TASK', 0, .8)], 3);
assert.equal(report.currentCount, 1);
assert.equal(report.replayCount, 3);
assert.equal(report.memorySize, 6);
assert.equal(report.seenCount, 8);
assert.ok(Number.isFinite(report.meanLoss01));
assert.equal(Object.values(report.perTaskMemory).reduce((a, b) => a + b, 0), report.memorySize);

// A malformed current batch must not mutate the buffer before training starts.
const beforeBadTraining = restored.snapshot();
assert.throws(() => trainWithExperienceReplay(learner, restored, [exp('BAD', 1), { ...exp('BAD', 2), features: [Infinity] }], 2), /finite-array/);
assert.deepEqual(restored.snapshot(), beforeBadTraining);

console.log('P26_CONTINUAL_REPLAY_BUFFER=PASS');
