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

console.log('P29_HERMES_REFLECTIVE_CANDIDATE_GATE=PASS pairedValidation=true untouchedHoldout=true safetyIsHardGate=true emptyRubricsRejected=true');
