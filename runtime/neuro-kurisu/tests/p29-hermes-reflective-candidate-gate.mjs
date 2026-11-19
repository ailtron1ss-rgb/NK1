import assert from 'node:assert/strict';
import {
  aggregateSkillLearnBenchReports,
  evaluateSkillLearnBenchCandidate,
  evaluateSkillLearnBenchTrial,
} from '../src/organism/learning/SkillLearnBenchAdapter.ts';

function trial(taskId, trialId, quality, safetyViolationCount = 0, taskFamily = undefined) {
  const good = quality === 'good';
  return evaluateSkillLearnBenchTrial({
    taskId,
    ...(taskFamily !== undefined ? { taskFamily } : {}),
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

function dimensionTrial(taskId, trialId, { verifierPassed, coveredCapabilityIds, observedStepIds }) {
  return evaluateSkillLearnBenchTrial({
    taskId,
    trialId,
    verifierPassed,
    skill: {
      requiredCapabilityIds: ['inspect', 'reason', 'verify'],
      coveredCapabilityIds,
      executable: true,
      safetyViolationCount: 0,
    },
    trajectory: {
      expectedStepIds: ['inspect', 'reason', 'verify'],
      observedStepIds,
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
assert.equal(accepted.validationTaskCount, 2);
assert.equal(accepted.pairedHoldoutTrials, 2);

// The indexed order matcher must preserve the old ordered-match semantics.
const reordered=evaluateSkillLearnBenchTrial({
  taskId:'order-check',trialId:'t1',verifierPassed:true,
  skill:{requiredCapabilityIds:['cap'],coveredCapabilityIds:['cap'],executable:true,safetyViolationCount:0},
  trajectory:{expectedStepIds:['a','b','c','d'],observedStepIds:['c','a','d','b']},
});
assert.equal(reordered.trajectoryQuality.keyPointRecall,1);
assert.equal(reordered.trajectoryQuality.executionOrder,0.5);

// Bound rubric work and identifier memory independently of upstream report size.
assert.throws(()=>evaluateSkillLearnBenchTrial({
  taskId:'oversized-rubric',trialId:'t1',verifierPassed:true,
  skill:{requiredCapabilityIds:Array.from({length:4097},(_,i)=>`cap-${i}`),coveredCapabilityIds:[],executable:true,safetyViolationCount:0},
  trajectory:{expectedStepIds:['step'],observedStepIds:[]},
}),/invalid-required-capability-ids/);
assert.throws(()=>evaluateSkillLearnBenchTrial({
  taskId:'long-rubric-id',trialId:'t1',verifierPassed:true,
  skill:{requiredCapabilityIds:['x'.repeat(257)],coveredCapabilityIds:[],executable:true,safetyViolationCount:0},
  trajectory:{expectedStepIds:['step'],observedStepIds:[]},
}),/invalid-required-capability-ids/);

 // A macro-average gain must not conceal a material regression on one validation
 // task. Per-task deltas average repeated trials first, so duplicated samples cannot
 // manufacture extra votes.
const mixedValidationBaseline = {
  validation: [
    trial('regressing-task', 'v1', 'good'),
    trial('improving-task-a', 'v1', 'weak'),
    trial('improving-task-b', 'v1', 'weak'),
  ],
  holdout: baseline.holdout,
};
const mixedValidationCandidate = {
  validation: [
    trial('regressing-task', 'v1', 'weak'),
    trial('improving-task-a', 'v1', 'good'),
    trial('improving-task-b', 'v1', 'good'),
  ],
  holdout: baseline.holdout,
};
const taskRegressionGate = evaluateSkillLearnBenchCandidate(mixedValidationBaseline, mixedValidationCandidate);
assert.ok(taskRegressionGate.validationGain01 > 0.005,
  'the overall validation mean should improve, otherwise this would not test a hidden regression');
assert.equal(taskRegressionGate.validationTaskRegressions, 1);
assert.ok(taskRegressionGate.reasons.includes('validation-task-regression-exceeds-tolerance'));
assert.equal(taskRegressionGate.eligible, false,
  'a large task-local regression cannot be washed out by gains on other tasks');

// A large gain on repeated trials from one validation task is still narrow evidence.
const narrowValidationBaseline={
  validation:[trial('task-a','v1','weak'),trial('task-a','v2','weak')],
  holdout:baseline.holdout,
};
const narrowValidationCandidate={
  validation:[trial('task-a','v1','good'),trial('task-a','v2','good')],
  holdout:improved.holdout,
};
const narrowValidationGate=evaluateSkillLearnBenchCandidate(narrowValidationBaseline,narrowValidationCandidate);
assert.equal(narrowValidationGate.validationTaskCount,1);
assert.ok(narrowValidationGate.reasons.includes('validation-task-coverage-insufficient'),
  'duplicate trials from one task must not substitute for independent validation task coverage');
assert.equal(narrowValidationGate.eligible,false);

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

// Do not allow the composite score to conceal a trajectory-quality regression.
const fullSkillAndTrajectory = (taskId, trialId, verifierPassed) => dimensionTrial(taskId, trialId, {
  verifierPassed,
  coveredCapabilityIds: ['inspect', 'reason', 'verify'],
  observedStepIds: ['inspect', 'reason', 'verify'],
});
const tradeoffBaseline = {
  validation: baseline.validation,
  holdout: [
    fullSkillAndTrajectory('task-c', 'h1', false),
    fullSkillAndTrajectory('task-d', 'h1', false),
  ],
};
const tradeoffCandidate = {
  validation: improved.validation,
  holdout: [
    dimensionTrial('task-c', 'h1', {
      verifierPassed: true,
      coveredCapabilityIds: ['inspect', 'reason', 'verify'],
      observedStepIds: ['verify', 'reason', 'inspect'],
    }),
    dimensionTrial('task-d', 'h1', {
      verifierPassed: true,
      coveredCapabilityIds: ['inspect', 'reason', 'verify'],
      observedStepIds: ['verify', 'reason', 'inspect'],
    }),
  ],
};
const componentRegression = evaluateSkillLearnBenchCandidate(tradeoffBaseline, tradeoffCandidate, {
  maximumHoldoutRegression01: 1,
});
assert.ok(componentRegression.holdoutDelta01 > 0,
  'the composite can improve even when trajectory quality regresses');
assert.equal(componentRegression.holdoutTrajectoryDelta01 < 0, true);
assert.equal(componentRegression.eligible, false);
assert.ok(componentRegression.reasons.includes('holdout-trajectory-regression-exceeds-tolerance'));

// Keep the other two dimensions independently gated as well.
const taskSuccessRegression = evaluateSkillLearnBenchCandidate(
  { validation: baseline.validation, holdout: [
    fullSkillAndTrajectory('task-c', 'h1', true),
    fullSkillAndTrajectory('task-d', 'h1', true),
  ] },
  { validation: improved.validation, holdout: [
    fullSkillAndTrajectory('task-c', 'h1', false),
    fullSkillAndTrajectory('task-d', 'h1', false),
  ] },
  { maximumHoldoutRegression01: 1 },
);
assert.ok(taskSuccessRegression.reasons.includes('holdout-task-success-regression-exceeds-tolerance'));

const skillQualityRegression = evaluateSkillLearnBenchCandidate(
  { validation: baseline.validation, holdout: [
    fullSkillAndTrajectory('task-c', 'h1', true),
    fullSkillAndTrajectory('task-d', 'h1', true),
  ] },
  { validation: improved.validation, holdout: [
    dimensionTrial('task-c', 'h1', {
      verifierPassed: true,
      coveredCapabilityIds: ['inspect'],
      observedStepIds: ['inspect', 'reason', 'verify'],
    }),
    dimensionTrial('task-d', 'h1', {
      verifierPassed: true,
      coveredCapabilityIds: ['inspect'],
      observedStepIds: ['inspect', 'reason', 'verify'],
    }),
  ] },
  { maximumHoldoutRegression01: 1 },
);
assert.ok(skillQualityRegression.reasons.includes('holdout-skill-quality-regression-exceeds-tolerance'));

// AFTER-inspired family gate: an overall mean improvement cannot hide a severe
// regression in one task family when the compensating gains come from another.
const familyBaseline = {
  validation: [trial('val-a','v1','weak'),trial('val-b','v1','weak')],
  holdout: [
    trial('memory-a','h1','good',0,'memory'),trial('memory-b','h1','good',0,'memory'),
    trial('perception-a','h1','weak',0,'perception'),trial('perception-b','h1','weak',0,'perception'),
  ],
};
const familyCandidate = {
  validation: [trial('val-a','v1','good'),trial('val-b','v1','good')],
  holdout: [
    trial('memory-a','h1','weak',0,'memory'),trial('memory-b','h1','weak',0,'memory'),
    trial('perception-a','h1','good',0,'perception'),trial('perception-b','h1','good',0,'perception'),
  ],
};
const familyRegression = evaluateSkillLearnBenchCandidate(familyBaseline,familyCandidate);
assert.equal(familyRegression.holdoutDelta01,0,
  'opposing family changes can leave the aggregate holdout mean unchanged');
assert.equal(familyRegression.holdoutFamiliesEvaluated,2);
assert.equal(familyRegression.holdoutFamilyRegressions,1);
assert.equal(familyRegression.eligible,false,
  'a sufficiently sampled held-out family regression must veto candidate promotion');
assert.ok(familyRegression.reasons.includes('holdout-family-regression-exceeds-tolerance'));
assert.ok(familyRegression.feedback.some(line=>line.includes('task family regressed')));
assert.ok(!familyRegression.feedback.some(line=>line.includes('memory')||line.includes('perception')),
  'family names and holdout-specific diagnostics must not leak into optimizer-facing feedback');
assert.equal(evaluateSkillLearnBenchCandidate(baseline,improved).holdoutFamilyRegressions,0,
  'legacy reports without canonical task-family metadata retain aggregate-only evaluation');

const oneSidedFamilyBaseline = {
  validation: baseline.validation,
  holdout: [trial('task-c','h1','good',0,'memory'),trial('task-d','h1','good',0,'memory')],
};
const oneSidedFamilyCandidate = {
  validation: improved.validation,
  holdout: [trial('task-c','h1','good'),trial('task-d','h1','good')],
};
assert.throws(()=>evaluateSkillLearnBenchCandidate(oneSidedFamilyBaseline,oneSidedFamilyCandidate),
  /candidate-holdout-task-family-mismatch/,
  'removing family provenance on only one side must not silently bypass a paired family gate');
assert.throws(()=>evaluateSkillLearnBenchCandidate(baseline,improved,null),
  /candidate-evaluation-data-boundary-rejected/,
  'invalid root gate options must fail closed after snapshotting');


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
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumValidationTasks: 0,
}), /candidate-minimum-validation-tasks-invalid/);
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  maximumValidationTaskRegression01: Number.NaN,
}), /candidate-maximum-validation-task-regression-invalid/);

// A tiny negative score delta can round to IEEE-754 -0 at the report boundary.
// Reports are consumed by canonical evidence stores, so expose one stable +0 representation.
const subMicroRegression = {
  validation: improved.validation.map((row, index) => index === 0 ? ({
    ...structuredClone(row),
    trajectoryQuality: {
      ...structuredClone(row.trajectoryQuality),
      completeness: 0.999997,
      aggregate: 0.999999,
    },
  }) : structuredClone(row)),
  holdout: improved.holdout,
};
const roundedZero = evaluateSkillLearnBenchCandidate(improved, subMicroRegression);
assert.equal(roundedZero.validationGain01, 0);
assert.equal(Object.is(roundedZero.validationGain01, -0), false,
  'tiny negative deltas must use canonical positive zero in the report');


assert.throws(() => evaluateSkillLearnBenchCandidate(null, improved), /candidate-evaluation-input-invalid/);
let familyAccessorCalls = 0;
const accessorTrialInput = Object.defineProperties({
  taskId:'accessor-task', trialId:'t1', verifierPassed:true,
  skill:{requiredCapabilityIds:['cap'],coveredCapabilityIds:['cap'],executable:true,safetyViolationCount:0},
  trajectory:{expectedStepIds:['step'],observedStepIds:['step']},
}, {
  taskFamily:{enumerable:true,get(){familyAccessorCalls++;return 'secret-family';}},
});
assert.throws(()=>evaluateSkillLearnBenchTrial(accessorTrialInput),/invalid-trial-data-boundary/);
assert.equal(familyAccessorCalls,0,'trial input accessors must not run before report validation');
const accessorReport = Object.defineProperty(trial('task-a','accessor-report','good'),'taskFamily',{
  enumerable:true,get(){familyAccessorCalls++;return 'secret-family';},
});
assert.throws(()=>evaluateSkillLearnBenchCandidate({
  validation:[accessorReport,baseline.validation[1]],holdout:baseline.holdout,
},improved),/candidate-evaluation-data-boundary-rejected/);
assert.equal(familyAccessorCalls,0,'report accessors must not run while calculating the candidate gate');
const baselineEnvelope = {};
Object.defineProperties(baselineEnvelope, {
  validation:{enumerable:true,get(){familyAccessorCalls++;return baseline.validation;}},
  holdout:{enumerable:true,value:baseline.holdout},
});
assert.throws(()=>evaluateSkillLearnBenchCandidate(baselineEnvelope,improved),/candidate-evaluation-data-boundary-rejected/);
assert.equal(familyAccessorCalls,0,'candidate-gate envelope getters must not run');
const getterOptions = Object.defineProperty({},'maximumHoldoutFamilyRegression01',{
  enumerable:true,get(){familyAccessorCalls++;return .1;},
});
assert.throws(()=>evaluateSkillLearnBenchCandidate(baseline,improved,getterOptions),/candidate-evaluation-data-boundary-rejected/);
assert.equal(familyAccessorCalls,0,'gate-option getters must not run');
const sparseReportBatch = [trial('task-a','sparse-batch','good'),,];
assert.throws(()=>evaluateSkillLearnBenchCandidate({
  validation:sparseReportBatch,holdout:baseline.holdout,
},improved),/candidate-evaluation-data-boundary-rejected/,
'sparse report batches must not skip family/evidence validation');

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

// A family-wide decline can be hidden by gains in another family even when no single task crosses its veto.
const moderateFamilyRegression = (report) => ({
  ...report,
  trajectoryQuality: {
    ...report.trajectoryQuality,
    keyPointRecall: 0.6,
    executionOrder: 0.6,
    completeness: 0.6,
    aggregate: 0.6,
  },
  skillQuality: {
    ...report.skillQuality,
    functionalCoverage: 0.7,
    executability: 0.7,
    safety: 1,
    aggregate: Number(((0.7 + 0.7 + 1) / 3).toFixed(6)),
  },
});
const validationFamilyBaseline = {
  validation: [
    trial('family-a-task-1', 'v1', 'good', 0, 'family-a'),
    trial('family-a-task-2', 'v1', 'good', 0, 'family-a'),
    trial('family-b-task-1', 'v1', 'weak', 0, 'family-b'),
    trial('family-b-task-2', 'v1', 'weak', 0, 'family-b'),
    trial('family-b-task-3', 'v1', 'weak', 0, 'family-b'),
  ],
  holdout: baseline.holdout,
};
const validationFamilyCandidate = {
  validation: [
    moderateFamilyRegression(trial('family-a-task-1', 'v1', 'good', 0, 'family-a')),
    moderateFamilyRegression(trial('family-a-task-2', 'v1', 'good', 0, 'family-a')),
    trial('family-b-task-1', 'v1', 'good', 0, 'family-b'),
    trial('family-b-task-2', 'v1', 'good', 0, 'family-b'),
    trial('family-b-task-3', 'v1', 'good', 0, 'family-b'),
  ],
  holdout: baseline.holdout,
};
const familyRegressionGate = evaluateSkillLearnBenchCandidate(validationFamilyBaseline, validationFamilyCandidate);
assert.ok(familyRegressionGate.validationGain01 > 0.005,
  'improvements in family B should make macro validation improve');
assert.equal(familyRegressionGate.validationTaskRegressions, 0,
  'the decline on each family-A task stays within the per-task tolerance');
assert.equal(familyRegressionGate.validationFamiliesEvaluated, 2);
assert.equal(familyRegressionGate.validationFamilyRegressions, 1);
assert.ok(familyRegressionGate.reasons.includes('validation-family-regression-exceeds-tolerance'));
assert.equal(familyRegressionGate.eligible, false,
  'broad regressions within one task family must not be hidden by improvements in another family');
assert.throws(() => evaluateSkillLearnBenchCandidate(validationFamilyBaseline, validationFamilyCandidate, {
  maximumValidationFamilyRegression01: Number.NaN,
}), /candidate-maximum-validation-family-regression-invalid/);

// Strict mode can require family provenance; legacy reports remain accepted only when the caller leaves the minimum at zero.
const missingFamilyCoverage = evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumValidationFamilies: 1,
  minimumHoldoutFamilies: 1,
});
assert.equal(missingFamilyCoverage.validationFamiliesEvaluated, 0);
assert.equal(missingFamilyCoverage.holdoutFamiliesEvaluated, 0);
assert.ok(missingFamilyCoverage.reasons.includes('validation-family-coverage-insufficient'));
assert.ok(missingFamilyCoverage.reasons.includes('holdout-family-coverage-insufficient'));
assert.equal(missingFamilyCoverage.eligible, false,
  'configured strict family coverage must not silently pass on unlabeled legacy reports');
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumValidationFamilies: -1,
}), /candidate-minimum-validation-families-invalid/);
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumHoldoutFamilies: 1.5,
}), /candidate-minimum-holdout-families-invalid/);

console.log('P29_HERMES_REFLECTIVE_CANDIDATE_GATE=PASS pairedValidation=true untouchedHoldout=true safetyIsHardGate=true emptyRubricsRejected=true validationFamilyRegression=true strictFamilyCoverage=true');
