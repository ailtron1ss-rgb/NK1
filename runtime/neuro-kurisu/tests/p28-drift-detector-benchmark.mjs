import assert from 'node:assert/strict';
import { AdaptiveWindowDriftDetector } from '../src/organism/learning/AdaptiveWindowDriftDetector.ts';
import { PageHinkleyDriftDetector } from '../src/organism/learning/PageHinkleyDriftDetector.ts';

// Deterministic, synthetic benchmark. It measures detector behavior only; it
// does not claim that replay improves downstream task quality.
const SEEDS = [11, 29, 47, 83, 101];
const STABLE_SAMPLES = 120;
const POST_DRIFT_SAMPLES = 160;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function noisySignal(random, mean, amplitude = 0.04) {
  // Symmetric bounded noise keeps every synthetic error inside [0, 1].
  return Math.max(0, Math.min(1, mean + (random() * 2 - 1) * amplitude));
}

function streamFor(scenario, seed) {
  const random = rng(seed);
  const values = [];
  if (scenario === 'stationary') {
    for (let i = 0; i < 300; i++) values.push(noisySignal(random, 0.25, 0.04));
  } else if (scenario === 'noisy-stationary') {
    for (let i = 0; i < 300; i++) values.push(noisySignal(random, 0.25, 0.14));
  } else if (scenario === 'abrupt') {
    for (let i = 0; i < STABLE_SAMPLES; i++) values.push(noisySignal(random, 0.2));
    for (let i = 0; i < POST_DRIFT_SAMPLES; i++) values.push(noisySignal(random, 0.68));
  } else if (scenario === 'gradual') {
    for (let i = 0; i < STABLE_SAMPLES; i++) values.push(noisySignal(random, 0.2));
    for (let i = 0; i < POST_DRIFT_SAMPLES; i++) {
      const progress = Math.min(1, (i + 1) / 100);
      values.push(noisySignal(random, 0.2 + 0.48 * progress));
    }
  } else {
    throw new Error(`unknown scenario: ${scenario}`);
  }
  return values;
}

function createDetectors() {
  return {
    'adaptive-window': new AdaptiveWindowDriftDetector({
      delta: 0.01, clock: 4, maxWindow: 256, minSubwindowLength: 5, gracePeriod: 20,
    }),
    'page-hinkley': new PageHinkleyDriftDetector({
      minInstances: 30, delta: 0.005, threshold: 0.18, alpha: 0.999, mode: 'both',
    }),
  };
}

function evaluate(kind, scenario, seed) {
  const detector = createDetectors()[kind];
  const stream = streamFor(scenario, seed);
  const changeAt = scenario === 'abrupt' || scenario === 'gradual' ? STABLE_SAMPLES : null;
  let falseAlarms = 0;
  let firstDelay = null;
  let alarmCount = 0;
  for (let index = 0; index < stream.length; index++) {
    const result = detector.update(stream[index]);
    if (!result.driftDetected) continue;
    alarmCount++;
    if (changeAt === null || index < changeAt) {
      falseAlarms++;
    } else if (firstDelay === null) {
      firstDelay = index - changeAt;
    }
  }
  return {
    kind, scenario, seed, samples: stream.length, alarmCount, falseAlarms,
    detected: firstDelay !== null,
    detectionDelay: firstDelay,
  };
}

const scenarios = ['stationary', 'noisy-stationary', 'abrupt', 'gradual'];
const kinds = ['adaptive-window', 'page-hinkley'];
const records = [];
for (const scenario of scenarios) {
  for (const kind of kinds) {
    for (const seed of SEEDS) records.push(evaluate(kind, scenario, seed));
  }
}

const summary = [];
for (const scenario of scenarios) {
  for (const kind of kinds) {
    const rows = records.filter((row) => row.scenario === scenario && row.kind === kind);
    const delays = rows.filter((row) => row.detectionDelay !== null).map((row) => row.detectionDelay);
    summary.push({
      scenario,
      detector: kind,
      seeds: rows.length,
      detectionRate: rows.filter((row) => row.detected).length / rows.length,
      meanDetectionDelay: delays.length ? Number((delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(2)) : null,
      falseAlarmsPerRun: Number((rows.reduce((sum, row) => sum + row.falseAlarms, 0) / rows.length).toFixed(2)),
      meanTotalAlarms: Number((rows.reduce((sum, row) => sum + row.alarmCount, 0) / rows.length).toFixed(2)),
    });
  }
}

assert.equal(records.length, scenarios.length * kinds.length * SEEDS.length);
assert.ok(summary.every((row) => row.seeds === SEEDS.length));
assert.ok(summary.every((row) => row.detectionRate >= 0 && row.detectionRate <= 1));
assert.ok(summary.every((row) => Number.isFinite(row.falseAlarmsPerRun)));
assert.ok(summary.filter((row) => row.scenario === 'stationary' || row.scenario === 'noisy-stationary')
  .every((row) => row.meanDetectionDelay === null));

console.log('WORKPASS92_DRIFT_BENCHMARK');
console.log(JSON.stringify({
  note: 'Synthetic deterministic signal benchmark; not downstream learning-quality evidence.',
  seeds: SEEDS,
  samplesPerScenario: { stationary: 300, 'noisy-stationary': 300, abrupt: STABLE_SAMPLES + POST_DRIFT_SAMPLES, gradual: STABLE_SAMPLES + POST_DRIFT_SAMPLES },
  summary,
}, null, 2));
