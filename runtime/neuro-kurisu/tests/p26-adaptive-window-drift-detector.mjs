import assert from 'node:assert/strict';
import { AdaptiveWindowDriftDetector } from '../src/organism/learning/AdaptiveWindowDriftDetector.ts';

const detector = new AdaptiveWindowDriftDetector({
  delta: 0.01,
  clock: 1,
  maxWindow: 256,
  minSubwindowLength: 5,
  gracePeriod: 20,
});

for (let i = 0; i < 100; i++) detector.update(0.2);
assert.equal(detector.nDetections, 0, 'stationary stream should not trigger on constant values');
assert.ok(Math.abs(detector.estimation - 0.2) < 1e-12, 'stationary estimate tolerates IEEE-754 rounding');
assert.equal(detector.width, 100);

let detectedAt = -1;
for (let i = 0; i < 100; i++) {
  const result = detector.update(0.8);
  if (result.driftDetected && detectedAt < 0) detectedAt = i;
}
assert.ok(detectedAt >= 0, 'step change should eventually be detected');
assert.ok(detector.nDetections >= 1);
assert.ok(detector.width < 200, 'detector should discard stale prefix after change');
assert.ok(detector.estimation > 0.65, 'post-drift window should favor the new distribution');

const snapshot = detector.snapshot();
const restored = new AdaptiveWindowDriftDetector({
  delta: 0.01,
  clock: 1,
  maxWindow: 256,
  minSubwindowLength: 5,
  gracePeriod: 20,
});
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(), snapshot);
assert.equal(restored.width, detector.width);
assert.equal(restored.nDetections, detector.nDetections);

assert.throws(() => detector.update(NaN), /adwin-value-must-be-finite-0-to-1/);
assert.throws(() => detector.update(1.1), /adwin-value-must-be-finite-0-to-1/);
assert.throws(() => new AdaptiveWindowDriftDetector({ delta: 1 }), /adwin-delta-out-of-range/);
assert.throws(() => new AdaptiveWindowDriftDetector({ clock: 0 }), /adwin-clock-invalid/);
assert.throws(() => restored.restore({ version: 1, values: [0.2] }), /adwin-snapshot-invalid/);

detector.reset();
assert.equal(detector.width, 0);
assert.equal(detector.nDetections, 0);
assert.equal(detector.estimation, null);
console.log('P26_ADAPTIVE_WINDOW_DRIFT_DETECTOR=PASS');
