import assert from 'node:assert/strict';
import {
  aggregateSkillLearnBenchReports,
  evaluateSkillLearnBenchCandidate,
  evaluateSkillLearnBenchTrial,
} from '../src/organism/learning/SkillLearnBenchAdapter.ts';

function trial(taskId, trialId, quality, safetyViolationCount = 0, taskFamily = 'general') {
  const good = quality === 'good';
  return evaluateSkillLearnBenchTrial({
    taskId,
    trialId,
    taskFamily,
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

// Aggregate improvement in trajectory/skill quality must not disguise low
// independently verified task success. The old gate emitted a warning only,
// so this candidate could remain eligible with a 50% task pass rate.
const lowPassButHighQuality = {
  ...trial('task-a', 'v1', 'good'),
  taskSuccess: { passed: false, passRate: 0 },
};
const lowSuccessCandidate = {
  validation: [lowPassButHighQuality, trial('task-b', 'v1', 'good')],
  holdout: baseline.holdout,
};
const lowSuccessGate = evaluateSkillLearnBenchCandidate(baseline, lowSuccessCandidate);
assert.equal(lowSuccessGate.validationGain01 > 0.005, true,
  'fixture must retain aggregate validation gain so the task-success gate is exercised');
assert.equal(lowSuccessGate.eligible, false,
  'an aggregate score gain cannot bypass the independently verified task-success floor');
assert.ok(lowSuccessGate.reasons.includes('validation-task-success-below-threshold'));
assert.ok(lowSuccessGate.feedback.some(line => line.includes('below the promotion threshold')));

// Deployment may explicitly select a different task-success target, but the
// threshold must be visible and constrained to [0, 1].
const lowerDeclaredThreshold = evaluateSkillLearnBenchCandidate(
  baseline,
  lowSuccessCandidate,
  { minimumValidationTaskSuccess01: 0.5 },
);
assert.equal(lowerDeclaredThreshold.eligible, true,
  'a 50% result meets an explicitly configured 50% floor when other gates pass');
assert.throws(
  () => evaluateSkillLearnBenchCandidate(baseline, lowSuccessCandidate, { minimumValidationTaskSuccess01: 1.01 }),
  /candidate-minimum-validation-task-success-invalid/,
);

const oneTaskValidationBaseline = {
  validation: [trial('task-a', 'v1', 'weak'), trial('task-a', 'v2', 'weak')],
  holdout: baseline.holdout,
};
const oneTaskValidationCandidate = {
  validation: [trial('task-a', 'v1', 'good'), trial('task-a', 'v2', 'good')],
  holdout: baseline.holdout,
};
const oneTaskValidationGate = evaluateSkillLearnBenchCandidate(
  oneTaskValidationBaseline,
  oneTaskValidationCandidate,
);
assert.equal(oneTaskValidationGate.validationGain01 > 0.005, true);
assert.equal(oneTaskValidationGate.eligible, false,
  'many repetitions on one validation task must not count as broad task coverage');
assert.ok(oneTaskValidationGate.reasons.includes('validation-task-coverage-insufficient'));
assert.equal(
  evaluateSkillLearnBenchCandidate(oneTaskValidationBaseline, oneTaskValidationCandidate, { minimumValidationTasks: 1 }).eligible,
  true,
  'deployment may intentionally lower the task-count floor while keeping the setting explicit',
);
assert.throws(
  () => evaluateSkillLearnBenchCandidate(oneTaskValidationBaseline, oneTaskValidationCandidate, { minimumValidationTasks: 0 }),
  /candidate-minimum-validation-tasks-invalid/,
);

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

assert.throws(() => evaluateSkillLearnBenchCandidate(null, improved), /candidate-evaluation-input-invalid/);
assert.throws(() => evaluateSkillLearnBenchTrial({
  taskId: 'missing-trajectory',
  trialId: 't1',
  verifierPassed: true,
  skill: { requiredCapabilityIds: ['cap-1'], coveredCapabilityIds: ['cap-1'], executable: true, safetyViolationCount: 0 },
}), /invalid-trajectory/);

// Completeness must penalize unexpected actions instead of duplicating recall.
const extraAction = evaluateSkillLearnBenchTrial({
  taskId: 'unexpected-action',
  trialId: 't1',
  verifierPassed: true,
  skill: { requiredCapabilityIds: ['cap-1'], coveredCapabilityIds: ['cap-1'], executable: true, safetyViolationCount: 0 },
  trajectory: { expectedStepIds: ['step-1', 'step-2'], observedStepIds: ['step-1', 'step-2', 'unrequested-step'] },
});
assert.equal(extraAction.trajectoryQuality.keyPointRecall, 1);
assert.equal(extraAction.trajectoryQuality.completeness, Number((4 / 5).toFixed(6)));

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

// Overall success can still look acceptable while a whole task family fails.
// The candidate improves memory across 9 tasks and raises trajectory/skill scores
// in tool-use and transfer, but those two families fail the independent verifier.
// A family-aware promotion gate must deny it despite positive aggregate gain.
function withVerifiedSuccess(report, passed) {
  return { ...report, taskSuccess: { passed, passRate: passed ? 1 : 0 } };
}
const familyBaseline = {
  validation: [
    ...Array.from({ length: 9 }, (_, i) => trial('memory-v-' + i, 'v1', 'weak', 0, 'memory')),
    trial('tool-v', 'v1', 'weak', 0, 'tool-use'),
    trial('transfer-v', 'v1', 'weak', 0, 'transfer'),
  ],
  holdout: [
    trial('memory-h', 'h1', 'weak', 0, 'memory'),
    trial('tool-h', 'h1', 'weak', 0, 'tool-use'),
    trial('transfer-h', 'h1', 'weak', 0, 'transfer'),
  ],
};
const familyCandidate = {
  validation: [
    ...Array.from({ length: 9 }, (_, i) => trial('memory-v-' + i, 'v1', 'good', 0, 'memory')),
    withVerifiedSuccess(trial('tool-v', 'v1', 'good', 0, 'tool-use'), false),
    withVerifiedSuccess(trial('transfer-v', 'v1', 'good', 0, 'transfer'), false),
  ],
  holdout: familyBaseline.holdout.map((report) => ({ ...report })),
};
const familyGate = evaluateSkillLearnBenchCandidate(familyBaseline, familyCandidate, {
  requiredTaskFamilies: ['memory', 'tool-use', 'transfer'],
});
assert.ok(familyGate.validationGain01 > 0.005, 'overall composite gain remains positive');
assert.ok(familyGate.validationTaskSuccess01 >= 0.8,
  'the overall success average clears the global floor in this adversarial fixture');
assert.equal(familyGate.taskFamilyCoverage01, 1, 'every requested family has matched validation and holdout evidence');
assert.equal(familyGate.eligible, false, 'a family-local failure must block promotion');
assert.ok(familyGate.reasons.includes('task-family-validation-success-below-threshold:tool-use'));
assert.ok(familyGate.reasons.includes('task-family-validation-success-below-threshold:transfer'));
assert.equal(familyGate.familyResults.find((row) => row.family === 'memory')?.validationTaskSuccess01, 1);
assert.equal(familyGate.familyResults.find((row) => row.family === 'tool-use')?.validationTaskSuccess01, 0);
assert.equal(familyGate.familyResults.find((row) => row.family === 'transfer')?.validationTaskSuccess01, 0);

// Missing family provenance must not be guessed from names or filled by aggregate averages.
const withoutFamily = (reports) => reports.map(({ taskFamily, ...report }) => report);
const missingFamilyGate = evaluateSkillLearnBenchCandidate(
  {
    validation: withoutFamily(baseline.validation),
    holdout: withoutFamily(baseline.holdout),
  },
  {
    validation: withoutFamily(improved.validation),
    holdout: withoutFamily(improved.holdout),
  },
);
assert.equal(missingFamilyGate.eligible, false);
assert.ok(missingFamilyGate.reasons.includes('task-family-evidence-missing'));
assert.ok(missingFamilyGate.taskFamilyCoverage01 < 1);

// Family identity cannot drift between baseline and candidate for the same paired trial.
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, {
  validation: [{ ...improved.validation[0], taskFamily: 'tool-use' }, improved.validation[1]],
  holdout: improved.holdout,
}), /candidate-validation-task-family-mismatch/);
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  requiredTaskFamilies: ['memory', 'memory'],
}), /candidate-required-task-families-duplicate/);
assert.equal(accepted.taskFamilyCoverage01, 1);
assert.equal(accepted.familyResults[0].family, 'general');
assert.equal(accepted.familyResults[0].validationTaskSuccess01, 1);

console.log('P29_HERMES_REFLECTIVE_CANDIDATE_GATE=PASS pairedValidation=true untouchedHoldout=true familyCoverage=true perFamilyPromotionGate=true safetyIsHardGate=true emptyRubricsRejected=true');
