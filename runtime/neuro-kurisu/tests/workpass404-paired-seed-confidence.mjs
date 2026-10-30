import assert from 'node:assert/strict';
import { bootstrapMeanConfidenceInterval } from '../src/organism/learning/PairedSeedConfidence.ts';

const stable = [0.08, 0.11, 0.09, 0.12, 0.10];
const first = bootstrapMeanConfidenceInterval(stable, { seed: 42, resamples: 4000, confidenceLevel: 0.95 });
const replay = bootstrapMeanConfidenceInterval(stable, { seed: 42, resamples: 4000, confidenceLevel: 0.95 });
assert.deepEqual(first, replay, 'the same paired-seed evidence must generate a reproducible interval');
assert.equal(first.sampleCount, 5);
assert.equal(first.resamples, 4000);
assert.equal(first.confidenceLevel, 0.95);
assert.ok(first.lower <= first.mean && first.mean <= first.upper);
assert.ok(first.lower > 0, 'consistent positive paired-seed deltas should retain a positive lower bootstrap bound');

const noisy = bootstrapMeanConfidenceInterval([-0.15, 0.14, 0.15], {
  seed: 7, resamples: 10000, confidenceLevel: 0.95,
});
assert.ok(noisy.mean > 0, 'the point estimate is positive despite one adverse seed');
assert.ok(noisy.lower <= 0,
  'the bootstrap interval must reveal that positive mean improvement is not robust to seed variability');

const negative = bootstrapMeanConfidenceInterval([-0.2, -0.1, -0.15, -0.05], { seed: 7 });
assert.ok(negative.upper < 0, 'uniformly regressing paired-seed deltas should have a negative upper bound');

assert.throws(() => bootstrapMeanConfidenceInterval([]), /paired-seed-bootstrap-values-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, Number.NaN]), /paired-seed-bootstrap-values-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 1.1]), /paired-seed-bootstrap-values-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { confidenceLevel: 1 }), /paired-seed-bootstrap-confidence-level-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { confidenceLevel: Number.NaN }), /paired-seed-bootstrap-confidence-level-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { resamples: Number.NaN }), /paired-seed-bootstrap-resamples-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { seed: Number.NaN }), /paired-seed-bootstrap-seed-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { resamples: 99 }), /paired-seed-bootstrap-resamples-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], { seed: -1 }), /paired-seed-bootstrap-seed-invalid/);
assert.throws(() => bootstrapMeanConfidenceInterval(
  Array.from({ length: 5000 }, (_, index) => index / 5000), { resamples: 4000 },
), /paired-seed-bootstrap-work-budget-exceeded/,
'large sample × resample combinations must be rejected before bootstrap loops allocate or run');

let valueGetterCalls = 0;
const getterValues = [0.1, 0.2];
Object.defineProperty(getterValues, '0', {
  configurable: true, enumerable: true,
  get() { valueGetterCalls++; return 0.1; },
});
assert.throws(() => bootstrapMeanConfidenceInterval(getterValues), /paired-seed-bootstrap-data-boundary-rejected/);
assert.equal(valueGetterCalls, 0, 'bootstrap data accessors must be rejected without invocation');

let optionGetterCalls = 0;
const getterOptions = {};
Object.defineProperty(getterOptions, 'seed', {
  configurable: true, enumerable: true,
  get() { optionGetterCalls++; return 7; },
});
assert.throws(() => bootstrapMeanConfidenceInterval([0.1, 0.2], getterOptions),
  /paired-seed-bootstrap-data-boundary-rejected/);
assert.equal(optionGetterCalls, 0, 'bootstrap policy accessors must be rejected without invocation');

console.log('WORKPASS404_PAIRED_SEED_CONFIDENCE=PASS deterministic=true positiveInterval=true noisyMeanDetected=true invalidInputsRejected=true hostileAccessorsRejected=true workBudgetRejected=true');
