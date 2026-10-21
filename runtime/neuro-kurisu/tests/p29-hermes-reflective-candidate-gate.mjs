import assert from 'node:assert/strict';
import {
  aggregateSkillLearnBenchReports,
  evaluateSkillLearnBenchCandidate,
  evaluateSkillLearnBenchTrial,
} from '../src/organism/learning/SkillLearnBenchAdapter.ts';

function trial(taskId, trialId, quality, safetyViolationCount = 0) {
  const good = quality === 'good';
  return evaluateSkillLearnBenchTrial({
    taskId,
    trialId,
    verifierPassed: good,
    skill: {
      requiredCapabilityIds: ['inspect', 'reason', 'verify'],
      coveredCapabilityIds: good ? ['inspect', 'reason', 'verify'] : ['inspect'],
      executable: true,
      safetyViolationCount,
    },
    trajectory: {
      expectedStepIds: ['inspect', 'reason', 'verify'],
      observedStepIds: good ? ['inspect', 'reason', 'verify'] : ['verify', 'inspect'],
    },
  });
}

const baseline = {
  validation: [trial('task-a', 'v1', 'weak'), trial('task-b', 'v1', 'weak')],
  holdout: [trial('task-c', 'h1', 'weak'), trial('task-d', 'h1', 'weak')],
};
const improved = {
  validation: [trial('task-a', 'v1', 'good'), trial('task-b', 'v1', 'good')],
  holdout: [trial('task-c', 'h1', 'good'), trial('task-d', 'h1', 'good')],
};

const accepted = evaluateSkillLearnBenchCandidate(baseline, improved);
assert.equal(accepted.eligible, true);
assert.deepEqual(accepted.reasons, []);
assert.ok(accepted.validationGain01 > 0.005);
assert.equal(accepted.holdoutTaskCount, 2);
assert.equal(accepted.pairedValidationTrials, 2);

assert.equal(accepted.pairedHoldoutTrials, 2);

// Task macro-average: repeating one task must not give it extra weight.
const imbalanced = {
  validation: [
    trial('task-a', 'v1', 'weak'),
    trial('task-a', 'v2', 'weak'),
    trial('task-b', 'v1', 'good'),
  ],
  holdout: [trial('task-c', 'h1', 'weak'), trial('task-d', 'h1', 'good')],
};
const imbalancedResult = evaluateSkillLearnBenchCandidate(imbalanced, imbalanced);
const weakScore = 0.5 * trial('task-a', 'v1', 'weak').taskSuccess.passRate +
  0.3 * trial('task-a', 'v1', 'weak').trajectoryQuality.aggregate +
  0.2 * trial('task-a', 'v1', 'weak').skillQuality.aggregate;
const goodScore = 0.5 * trial('task-b', 'v1', 'good').taskSuccess.passRate +
  0.3 * trial('task-b', 'v1', 'good').trajectoryQuality.aggregate +
  0.2 * trial('task-b', 'v1', 'good').skillQuality.aggregate;
assert.equal(imbalancedResult.baselineValidation01, Number(((weakScore + goodScore) / 2).toFixed(6)));

// Validation-only improvement cannot hide a meaningful held-out regression.
const regressed = evaluateSkillLearnBenchCandidate(baseline, {
  validation: improved.validation,
  holdout: [trial('task-c', 'h1', 'weak'), trial('task-d', 'h1', 'weak')],
});
assert.equal(regressed.eligible, true); // holdout matches baseline, not regressed
assert.equal(regressed.holdoutDelta01, 0);

const unsafe = evaluateSkillLearnBenchCandidate(baseline, {
  validation: improved.validation,
  holdout: [trial('task-c', 'h1', 'good', 1), trial('task-d', 'h1', 'good')],
});
assert.equal(unsafe.eligible, false);
assert.ok(unsafe.reasons.includes('candidate-safety-violations-present'));
assert.ok(unsafe.feedback.some((line) => line.includes('safety violation')));

const holdoutRegression = evaluateSkillLearnBenchCandidate(improved, {
  validation: improved.validation,
  holdout: baseline.holdout,
});
assert.equal(holdoutRegression.eligible, false);
assert.ok(holdoutRegression.reasons.includes('holdout-regression-exceeds-tolerance'));

assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, {
  validation: [trial('task-a', 'v1', 'good')],
  holdout: improved.holdout,
}), /candidate-validation-trials-must-match-exactly/);
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, {
  validation: improved.validation,
  holdout: [],
}), /candidate-candidate-holdout-reports-required/);

assert.throws(() => evaluateSkillLearnBenchCandidate(
  { validation: baseline.validation, holdout: baseline.validation },
  { validation: improved.validation, holdout: improved.validation },
), /candidate-validation-holdout-task-overlap/);

// Reject internally inconsistent reports instead of trusting claimed aggregates.
const forged = trial('task-a', 'v1', 'good');
forged.skillQuality.aggregate = 0.5;
assert.throws(() => evaluateSkillLearnBenchCandidate({
  validation: [forged, trial('task-b', 'v1', 'good')],
  holdout: baseline.holdout,
}, {
  validation: improved.validation,
  holdout: improved.holdout,
}), /candidate-baseline-validation-report-invalid/);
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumValidationGain01: Number.NaN,
}), /candidate-minimum-validation-gain-invalid/);

// Empty reference rubrics previously scored as perfect through ratio(0, 0).
assert.throws(() => evaluateSkillLearnBenchTrial({
  taskId: 'empty-capability-rubric',
  trialId: 't1',
  verifierPassed: true,
  skill: { requiredCapabilityIds: [], coveredCapabilityIds: [], executable: true, safetyViolationCount: 0 },
  trajectory: { expectedStepIds: ['step-1'], observedStepIds: ['step-1'] },
}), /empty-required-capability-rubric/);
assert.throws(() => evaluateSkillLearnBenchTrial({
  taskId: 'empty-trajectory-rubric',
  trialId: 't1',
  verifierPassed: true,
  skill: { requiredCapabilityIds: ['cap-1'], coveredCapabilityIds: ['cap-1'], executable: true, safetyViolationCount: 0 },
  trajectory: { expectedStepIds: [], observedStepIds: [] },
}), /empty-expected-trajectory-rubric/);

// Whitespace variants must not inflate the number of distinct holdout tasks.
const oneTaskHoldout = [
  trial('task-c', 'h1', 'good'),
  trial(' task-c ', 'h2', 'good'),
];
const oneTaskGate = evaluateSkillLearnBenchCandidate(
  { validation: baseline.validation, holdout: oneTaskHoldout },
  { validation: improved.validation, holdout: oneTaskHoldout },
);
assert.equal(oneTaskGate.holdoutTaskCount, 1);
assert.ok(oneTaskGate.reasons.includes('holdout-task-coverage-insufficient'));

// Aggregate API rejects duplicate task/trial evidence and normalizes task identity.
const duplicated = trial('task-a', 'dup', 'good');
assert.throws(() => aggregateSkillLearnBenchReports([duplicated, { ...duplicated }]), /duplicate-report-trial/);
const normalizedAggregate = aggregateSkillLearnBenchReports([
  trial(' task-a ', 'a1', 'good'),
  trial('task-a', 'a2', 'weak'),
]);
assert.equal(normalizedAggregate.taskCount, 1);
assert.equal(normalizedAggregate.byTask[0].taskId, 'task-a');

console.log('P29_HERMES_REFLECTIVE_CANDIDATE_GATE=PASS pairedValidation=true untouchedHoldout=true safetyIsHardGate=true emptyRubricsRejected=true');
