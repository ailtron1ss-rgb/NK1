import assert from 'node:assert/strict';
import { AdaptiveWindowDriftDetector } from '../src/organism/learning/AdaptiveWindowDriftDetector.ts';
import { DriftAwareLearningController } from '../src/organism/learning/DriftAwareLearningController.ts';
import { ContinualReplayBuffer } from '../src/organism/learning/ContinualReplayBuffer.ts';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const options = { delta: 0.01, clock: 1, maxWindow: 128, minSubwindowLength: 5, gracePeriod: 20 };
const detector = new AdaptiveWindowDriftDetector(options);
for (let i = 0; i < 80; i++) detector.update(0.2);
let detected = false;
for (let i = 0; i < 80; i++) {
  if (detector.update(0.8).driftDetected) { detected = true; break; }
}
assert.equal(detected, true, 'drift detector should find a clear distribution shift');

const learner = new ParametricPolicyLearner();
const buffer = new ContinualReplayBuffer(64, undefined, () => 0.5);
const controller = new DriftAwareLearningController({
  detector: options,
  driftReplayMultiplier: 1.5,
});
const current = {
  taskId: 'evaluation-task',
  features: [0.1, 0.2, 0.3],
  action: 'verify',
  target01: 0.7,
  learningRate01: 0.05,
};
let stableReport;
for (let i = 0; i < 80; i++) {
  stableReport = controller.observeAndTrain({
    learner, buffer, current: [{ ...current, taskId: 'stable-task' }],
    replayBatchSize: 2, heldOutQuality01: 0.8,
  });
}
assert.equal(stableReport.selectedPolicy, 'balanced-stable');

let driftReport;
for (let i = 0; i < 80; i++) {
  driftReport = controller.observeAndTrain({
    learner, buffer, current: [{ ...current, taskId: 'shifted-task' }],
    replayBatchSize: 2, heldOutQuality01: 0.2,
  });
  if (driftReport.detector.driftDetected) break;
}
assert.ok(driftReport.detector.driftDetected);
assert.equal(driftReport.selectedPolicy, 'prioritized-after-drift');
assert.equal(driftReport.replay.replayStrategy, 'prioritized');
assert.equal(driftReport.replayBatchSize, 3);
assert.ok(driftReport.replay.replayCount <= 3);

const restored = new DriftAwareLearningController({ detector: options, driftReplayMultiplier: 1.5 });
restored.restore(controller.snapshot());
assert.deepEqual(restored.snapshot(), controller.snapshot());
assert.throws(() => new DriftAwareLearningController({ driftReplayMultiplier: 0.5 }), /drift-replay-multiplier-out-of-range/);
assert.throws(() => controller.observeAndTrain({
  learner, buffer, current: [], replayBatchSize: 1, heldOutQuality01: 2,
}), /drift-quality-out-of-range/);
console.log('P26_DRIFT_AWARE_LEARNING_CONTROLLER=PASS');
