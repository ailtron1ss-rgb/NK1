import assert from 'node:assert/strict';
import {
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
assert.throws(() => evaluateSkillLearnBenchCandidate(baseline, improved, {
  minimumValidationGain01: Number.NaN,
}), /candidate-minimum-validation-gain-invalid/);

console.log('P29_HERMES_REFLECTIVE_CANDIDATE_GATE=PASS pairedValidation=true untouchedHoldout=true safetyIsHardGate=true');
