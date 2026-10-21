import assert from 'node:assert/strict';
import {
  aggregateSkillLearnBenchReports,
  evaluateSkillLearnBenchTrial,
} from '../src/organism/learning/SkillLearnBenchAdapter.ts';

const good = evaluateSkillLearnBenchTrial({
  taskId: 'repo-analysis',
  trialId: 'seed-1',
  verifierPassed: true,
  skill: {
    requiredCapabilityIds: ['inspect', 'summarize', 'cite'],
    coveredCapabilityIds: ['inspect', 'summarize', 'cite'],
    executable: true,
    safetyViolationCount: 0,
  },
  trajectory: {
    expectedStepIds: ['open', 'inspect', 'summarize'],
    observedStepIds: ['open', 'inspect', 'summarize'],
  },
});
assert.equal(good.taskSuccess.passRate, 1);
assert.equal(good.skillQuality.aggregate, 1);
assert.equal(good.trajectoryQuality.aggregate, 1);

const degraded = evaluateSkillLearnBenchTrial({
  taskId: 'repo-analysis',
  trialId: 'seed-2',
  verifierPassed: false,
  skill: {
    requiredCapabilityIds: ['inspect', 'summarize', 'cite'],
    coveredCapabilityIds: ['inspect'],
    executable: false,
    safetyViolationCount: 1,
  },
  trajectory: {
    expectedStepIds: ['open', 'inspect', 'summarize'],
    observedStepIds: ['summarize', 'open', 'unknown'],
  },
});
assert.equal(degraded.taskSuccess.passRate, 0);
assert.equal(degraded.skillQuality.functionalCoverage, 1 / 3);
assert.equal(degraded.skillQuality.executability, 0);
assert.equal(degraded.skillQuality.safety, 0);
assert.deepEqual(degraded.skillQuality.missingCapabilityIds, ['summarize', 'cite']);
assert.equal(degraded.trajectoryQuality.keyPointRecall, 2 / 3);
assert.equal(degraded.trajectoryQuality.executionOrder, 1 / 3);
assert.deepEqual(degraded.trajectoryQuality.missingStepIds, ['inspect']);
assert.deepEqual(degraded.trajectoryQuality.unexpectedStepIds, ['unknown']);

const aggregate = aggregateSkillLearnBenchReports([good, degraded, {
  ...good, taskId: 'small-task', trialId: 'seed-3',
}]);
assert.equal(aggregate.trialCount, 3);
assert.equal(aggregate.taskCount, 2);
// Macro average: repo-analysis is 50% success; small-task is 100% success.
assert.equal(aggregate.taskSuccessRate, .75);
assert.deepEqual(aggregate.byTask.map((row) => row.taskId), ['repo-analysis', 'small-task']);

assert.throws(() => evaluateSkillLearnBenchTrial({
  taskId: 'bad', trialId: 'bad', verifierPassed: true,
  skill: { requiredCapabilityIds: ['x', 'x'], coveredCapabilityIds: [], executable: true, safetyViolationCount: 0 },
  trajectory: { expectedStepIds: [], observedStepIds: [] },
}), /duplicate-required-capability-ids/);
assert.throws(() => evaluateSkillLearnBenchTrial({
  taskId: 'bad', trialId: 'bad', verifierPassed: true,
  skill: { requiredCapabilityIds: [], coveredCapabilityIds: [], executable: true, safetyViolationCount: -1 },
  trajectory: { expectedStepIds: [], observedStepIds: [] },
}), /invalid-safety-violation-count/);
assert.throws(() => aggregateSkillLearnBenchReports([]), /reports-required/);

console.log('P26_SKILLLEARNBENCH_ADAPTER=PASS axes=task-success,skill-quality,trajectory-quality macroAveraging=true duplicateRubricsRejected=true');
