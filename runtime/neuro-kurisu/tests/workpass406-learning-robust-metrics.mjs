import assert from 'node:assert/strict';
import { summarizeLearningRobustMetrics } from '../src/organism/learning/LearningRobustMetrics.ts';

function report(taskId, seed, taskSuccess, skillQuality, trajectoryQuality) {
  return {
    taskId,
    trialId: `${taskId}-seed-${seed}`,
    taskSuccess: { passed: taskSuccess >= 1, passRate: taskSuccess },
    skillQuality: {
      functionalCoverage: skillQuality,
      executability: skillQuality,
      safety: skillQuality,
      aggregate: skillQuality,
      missingCapabilityIds: [],
      safetyViolationCount: 0,
    },
    trajectoryQuality: {
      keyPointRecall: trajectoryQuality,
      executionOrder: trajectoryQuality,
      completeness: trajectoryQuality,
      aggregate: trajectoryQuality,
      missingStepIds: [],
      unexpectedStepIds: [],
    },
  };
}

const baseline = [];
const candidate = [];
const scores = [
  { task: 'task-a', success: [0, 0], candidateSuccess: [0, 0], skill: 0.2, candidateSkill: 0.3, trajectory: 0.1, candidateTrajectory: 0.2 },
  { task: 'task-b', success: [0.5, 0.5], candidateSuccess: [0.6, 0.6], skill: 0.4, candidateSkill: 0.3, trajectory: 0.4, candidateTrajectory: 0.5 },
  { task: 'task-c', success: [0.5, 0.5], candidateSuccess: [0.6, 0.6], skill: 0.6, candidateSkill: 0.8, trajectory: 0.6, candidateTrajectory: 0.7 },
  { task: 'task-d', success: [1, 1], candidateSuccess: [0.9, 0.9], skill: 0.8, candidateSkill: 0.7, trajectory: 0.9, candidateTrajectory: 0.8 },
];
for (const row of scores) {
  for (const seed of [1, 2]) {
    const index = seed - 1;
    baseline.push(report(row.task, seed, row.success[index], row.skill, row.trajectory));
    candidate.push(report(row.task, seed, row.candidateSuccess[index], row.candidateSkill, row.candidateTrajectory));
  }
}

const metrics = summarizeLearningRobustMetrics(baseline, candidate);
assert.equal(metrics.schemaVersion, 2);
assert.equal(metrics.diagnosticOnly, true);
assert.equal(metrics.taskCount, 4);
assert.equal(metrics.matchedTrialCount, 8);
assert.equal(metrics.taskSuccess.baselineTaskBalancedIqm, 0.5);
assert.equal(metrics.taskSuccess.candidateTaskBalancedIqm, 0.6);
assert.equal(metrics.taskSuccess.taskBalancedIqmDelta, 0.1);
assert.equal(metrics.taskSuccess.baselineTaskBalancedMedian, 0.5);
assert.equal(metrics.taskSuccess.candidateTaskBalancedMedian, 0.6);
assert.equal(metrics.taskSuccess.taskBalancedMedianDelta, 0.1);
assert.equal(metrics.taskSuccess.baselineTaskBalancedOptimalityGap, 0.5);
assert.equal(metrics.taskSuccess.candidateTaskBalancedOptimalityGap, 0.475);
assert.equal(metrics.taskSuccess.taskBalancedOptimalityGapDelta, -0.025);
assert.equal(metrics.taskSuccess.pairedProbabilityOfImprovement, 0.625);
assert.equal(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.sampleCount, 4);
assert.equal(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.resamples, 2000);
assert.equal(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.confidenceLevel, 0.95);
assert.ok(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.lower <= metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.mean);
assert.ok(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.mean <= metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.upper);
assert.ok(metrics.taskSuccess.taskBalancedMeanDeltaBootstrapInterval.lower <= 0,
  'task-level uncertainty should show that a positive point estimate can remain uncertain');
assert.equal(metrics.skillQuality.baselineTaskBalancedIqm, 0.5);
assert.equal(metrics.skillQuality.candidateTaskBalancedIqm, 0.5);
assert.equal(metrics.skillQuality.taskBalancedIqmDelta, 0);
assert.equal(metrics.skillQuality.baselineTaskBalancedMedian, 0.5);
assert.equal(metrics.skillQuality.candidateTaskBalancedMedian, 0.5);
assert.equal(metrics.skillQuality.baselineTaskBalancedOptimalityGap, 0.5);
assert.equal(metrics.skillQuality.candidateTaskBalancedOptimalityGap, 0.475);
assert.equal(metrics.trajectoryQuality.taskBalancedIqmDelta, 0.1);
assert.equal(metrics.trajectoryQuality.taskBalancedMedianDelta, 0.1);
assert.equal(metrics.trajectoryQuality.taskBalancedOptimalityGapDelta, -0.05);
assert.equal(metrics.trajectoryQuality.pairedProbabilityOfImprovement, 0.75);

// Permutation of input rows cannot change task weighting or results.
assert.deepEqual(
  summarizeLearningRobustMetrics([...baseline].reverse(), [...candidate].sort((a, b) => b.trialId.localeCompare(a.trialId))),
  metrics,
);

/* A heterogeneous multi-seed corpus protects deterministic summation order,
 * not only the simple two-equal-seed arithmetic above. */
const precisionBaseline = [];
const precisionCandidate = [];
for (let taskIndex = 0; taskIndex < 5; taskIndex++) {
  for (let seed = 1; seed <= 37; seed++) {
    const taskId = `precision-task-${taskIndex}`;
    const baselineScore = (((seed * (taskIndex * 29 + 17)) % 997) + 0.125) / 997;
    const adjustment = ((seed % 5) - 2) * 0.00001;
    const candidateScore = Math.max(0, Math.min(1, baselineScore + adjustment));
    precisionBaseline.push(report(taskId, seed, baselineScore, baselineScore, baselineScore));
    precisionCandidate.push(report(taskId, seed, candidateScore, candidateScore, candidateScore));
  }
}
const precisionMetrics = summarizeLearningRobustMetrics(precisionBaseline, precisionCandidate);
assert.deepEqual(
  summarizeLearningRobustMetrics(
    [...precisionBaseline].reverse(),
    [...precisionCandidate].sort((a, b) => b.trialId.localeCompare(a.trialId)),
  ),
  precisionMetrics,
  'task means must be deterministic when fractional trial rows are permuted',
);

const singleTaskSummary = summarizeLearningRobustMetrics(
  [report('single-task', 1, 0.4, 0.4, 0.4), report('single-task', 2, 0.5, 0.5, 0.5)],
  [report('single-task', 1, 0.6, 0.6, 0.6), report('single-task', 2, 0.7, 0.7, 0.7)],
);
for (const dimension of [singleTaskSummary.taskSuccess, singleTaskSummary.skillQuality, singleTaskSummary.trajectoryQuality]) {
  assert.equal(dimension.taskBalancedMeanDeltaBootstrapInterval, null,
    'one task is insufficient to estimate between-task uncertainty');
}

// A missing matched seed cannot be silently dropped from one side.
assert.throws(() => summarizeLearningRobustMetrics(baseline, candidate.slice(1)),
  /learning-robust-metrics-trial-count-mismatch/);
const mismatched = candidate.map(row => ({ ...row }));
mismatched[0].trialId = 'different-seed';
assert.throws(() => summarizeLearningRobustMetrics(baseline, mismatched),
  /learning-robust-metrics-pair-mismatch/);

// Invalid out-of-range scores never turn into a favorable diagnostic.
const invalid = candidate.map(row => structuredClone(row));
invalid[0].taskSuccess.passRate = 1.01;
assert.throws(() => summarizeLearningRobustMetrics(baseline, invalid),
  /learning-robust-metrics-score-invalid/);

// Data-boundary rejection must not execute attacker-controlled accessors.
let getterCalls = 0;
const hostile = structuredClone(baseline);
Object.defineProperty(hostile[0], 'taskId', {
  enumerable: true,
  configurable: true,
  get() { getterCalls++; return 'forged-task'; },
});
assert.throws(() => summarizeLearningRobustMetrics(hostile, candidate),
  /learning-robust-metrics-baseline-data-boundary-rejected/);
assert.equal(getterCalls, 0);

const ceilingBaseline = Array.from({ length: 4 }, (_, index) => report(`ceiling-${index}`, 1, 1, 1, 1));
const ceilingCandidate = Array.from({ length: 4 }, (_, index) => report(`ceiling-${index}`, 1, 1, 1, 1));
const ceilingMetrics = summarizeLearningRobustMetrics(ceilingBaseline, ceilingCandidate);
for (const dimension of [ceilingMetrics.taskSuccess, ceilingMetrics.skillQuality, ceilingMetrics.trajectoryQuality]) {
  assert.equal(dimension.baselineTaskBalancedOptimalityGap, 0);
  assert.equal(dimension.candidateTaskBalancedOptimalityGap, 0);
  assert.equal(dimension.taskBalancedOptimalityGapDelta, 0);
  assert.equal(dimension.taskBalancedMeanDeltaBootstrapInterval.mean, 0);
  assert.equal(dimension.taskBalancedMeanDeltaBootstrapInterval.lower, 0);
  assert.equal(dimension.taskBalancedMeanDeltaBootstrapInterval.upper, 0);
}

console.log('WORKPASS406_LEARNING_ROBUST_METRICS=PASS taskBalancedIqm=true taskBalancedMedian=true optimalityGap=true pairedImprovement=true variedFractionalTrialOrderInvariant=true malformedEvidenceRejected=true accessorNotInvoked=true diagnosticOnly=true');
