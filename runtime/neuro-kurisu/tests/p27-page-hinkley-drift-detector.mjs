import assert from 'node:assert/strict';
import { PageHinkleyDriftDetector } from '../src/organism/learning/PageHinkleyDriftDetector.ts';
import { DriftAwareLearningController } from '../src/organism/learning/DriftAwareLearningController.ts';
import { ContinualReplayBuffer } from '../src/organism/learning/ContinualReplayBuffer.ts';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const options = { minInstances: 10, delta: 0.001, threshold: 0.12, alpha: 1, mode: 'up' };
const detector = new PageHinkleyDriftDetector(options);
for (let i = 0; i < 80; i++) detector.update(0.1);
let alarm = false;
for (let i = 0; i < 80; i++) {
  if (detector.update(0.9).driftDetected) { alarm = true; break; }
}
assert.equal(alarm, true, 'Page-Hinkley should detect a sustained upward mean shift');

const downward = new PageHinkleyDriftDetector({ ...options, mode: 'down' });
for (let i = 0; i < 80; i++) downward.update(0.9);
let downAlarm = false;
for (let i = 0; i < 80; i++) {
  if (downward.update(0.1).driftDetected) { downAlarm = true; break; }
}
assert.equal(downAlarm, true, 'down mode should detect a sustained downward mean shift');

const restored = new PageHinkleyDriftDetector(options);
restored.restore(detector.snapshot());
assert.deepEqual(restored.snapshot(), detector.snapshot());
assert.throws(() => new PageHinkleyDriftDetector({ alpha: 1.1 }), /page-hinkley-alpha-invalid/);
assert.throws(() => detector.update(Number.NaN), /page-hinkley-value-must-be-finite/);

const learner = new ParametricPolicyLearner();
const buffer = new ContinualReplayBuffer(64, undefined, () => 0.5);
const controller = new DriftAwareLearningController({
  detectorKind: 'page-hinkley',
  pageHinkley: options,
  driftReplayMultiplier: 1.5,
});
const experience = {
  taskId: 'ph-task',
  features: [0.1, 0.2, 0.3],
  action: 'verify',
  target01: 0.7,
  learningRate01: 0.05,
};
let report;
for (let i = 0; i < 80; i++) {
  report = controller.observeAndTrain({
    learner, buffer, current: [{ ...experience }], replayBatchSize: 2, heldOutQuality01: 0.9,
  });
}
assert.equal(report.detector.kind, 'page-hinkley');
assert.equal(report.selectedPolicy, 'balanced-stable');
let driftReport;
for (let i = 0; i < 80; i++) {
  driftReport = controller.observeAndTrain({
    learner, buffer, current: [{ ...experience, taskId: 'shifted' }],
    replayBatchSize: 2, heldOutQuality01: 0.1,
  });
  if (driftReport.detector.driftDetected) break;
}
assert.ok(driftReport.detector.pageHinkleyDetected);
assert.equal(driftReport.selectedPolicy, 'prioritized-after-drift');
assert.equal(driftReport.replay.replayStrategy, 'prioritized');
const controllerCopy = new DriftAwareLearningController({
  detectorKind: 'page-hinkley', pageHinkley: options, driftReplayMultiplier: 1.5,
});
controllerCopy.restore(controller.snapshot());
assert.deepEqual(controllerCopy.snapshot(), controller.snapshot());
console.log('P27_PAGE_HINKLEY_DRIFT=PASS');
