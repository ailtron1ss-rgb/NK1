import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const engine = new P23LearningEngine();
function report(taskId, trialId, passed, safe = true) {
  const coverage = passed ? 1 : 1 / 3;
  const order = passed ? 1 : 1 / 3;
  const completeness = passed ? 1 : 1 / 3;
  const trajectory = Number(((order + order + completeness) / 3).toFixed(6));
  const skill = Number(((coverage + 1 + (safe ? 1 : 0)) / 3).toFixed(6));
  return {
    taskId, trialId,
    taskSuccess: { passed, passRate: passed ? 1 : 0 },
    skillQuality: {
      functionalCoverage: coverage, executability: 1, safety: safe ? 1 : 0,
      aggregate: skill, missingCapabilityIds: passed ? [] : ['verify'],
      safetyViolationCount: safe ? 0 : 1,
    },
    trajectoryQuality: {
      keyPointRecall: order, executionOrder: order, completeness,
      aggregate: trajectory, missingStepIds: passed ? [] : ['verify'], unexpectedStepIds: [],
    },
  };
}
const baseline = {
  validation: [report('v-task-1','v1',false), report('v-task-2','v1',false)],
  holdout: [report('h-task-1','h1',false), report('h-task-2','h1',false)],
};
const improved = {
  validation: [report('v-task-1','v1',true), report('v-task-2','v1',true)],
  holdout: [report('h-task-1','h1',true), report('h-task-2','h1',true)],
};
const accepted = engine.evaluateReflectiveSkillCandidate(baseline, improved);
assert.equal(accepted.eligible, true);
assert.ok(accepted.validationGain01 > 0);
assert.equal(accepted.holdoutTaskCount, 2);

const unsafe = engine.evaluateReflectiveSkillCandidate(baseline, {
  validation: improved.validation,
  holdout: [report('h-task-1','h1',true,false), report('h-task-2','h1',true)],
});
assert.equal(unsafe.eligible, false);
assert.ok(unsafe.reasons.includes('candidate-safety-violations-present'));

// This surface is advisory only; it exposes no stage/promote/activate side effect.
assert.equal(typeof engine.stageVerifiedSkillCandidate, 'function');
assert.equal(engine.verifiedSkillCandidateSnapshot(), null);
console.log('P23_HERMES_REFLECTIVE_DIAGNOSTICS=PASS advisoryOnly=true safetyHardGate=true');
