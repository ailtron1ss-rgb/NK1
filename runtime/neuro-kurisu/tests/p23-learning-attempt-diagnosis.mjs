import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const engine = new P23LearningEngine();

const failure = engine.diagnoseLearningAttempt({
  taskId: 'task-17',
  objective: 'Save the generated file and verify it can be read back.',
  outcome: 'failure',
  observedBehavior: 'The tool call failed before the file could be read.',
  expectedBehavior: 'The generated file is saved and readable.',
  errorMessages: ['Tool call failed: gateway error', 'operation timed out'],
});
assert.equal(failure.taskId, 'task-17');
assert.match(failure.objective, /read back/);
assert.ok(failure.failureSignals.includes('task_failed'));
assert.ok(failure.failureSignals.includes('explicit_error_evidence'));
assert.ok(failure.failureSignals.includes('expected_observed_mismatch'));
assert.ok(failure.failureClasses.includes('tool-error'));
assert.ok(failure.failureClasses.includes('timeout'));
assert.ok(failure.failureClasses.includes('postcondition-mismatch'));
assert.equal(failure.promotionEligible, false);
assert.equal(failure.confidenceSemantics, 'heuristic-evidence-coverage-not-calibrated');
assert.match(failure.evidenceFingerprint, /^[a-f0-9]{64}$/);
assert.equal(
  failure.evidenceFingerprint,
  engine.diagnoseLearningAttempt({
    taskId: 'task-17',
    objective: 'Save the generated file and verify it can be read back.',
    outcome: 'failure',
    observedBehavior: 'The tool call failed before the file could be read.',
    expectedBehavior: 'The generated file is saved and readable.',
    errorMessages: ['Tool call failed: gateway error', 'operation timed out'],
  }).evidenceFingerprint,
  'equivalent normalized evidence has a stable fingerprint',
);

const success = engine.diagnoseLearningAttempt({
  taskId: 'task-18',
  objective: 'Confirm the skill completes the task.',
  outcome: 'success',
  observedBehavior: 'The action completed and its postcondition was observed.',
});
assert.ok(success.hypotheses.some((item) => item.includes('not yet evidence of generalized skill improvement')));
assert.ok(success.nextExperiments.some((item) => item.includes('held-out cases')));
assert.equal(success.promotionEligible, false);

const unknown = engine.diagnoseLearningAttempt({
  taskId: 'task-19',
  objective: 'Inspect the result.',
  outcome: 'unknown',
});
assert.ok(unknown.failureSignals.includes('missing_observation'));
assert.ok(unknown.failureClasses.includes('low-confidence'));
assert.ok(unknown.confidence < success.confidence);
assert.ok(unknown.nextExperiments.some((item) => item.includes('independent evaluator')));

const safety = engine.diagnoseLearningAttempt({
  taskId: 'task-20',
  objective: 'Understand why the action was refused.',
  outcome: 'failure',
  observedBehavior: 'The EthicalGate blocked the requested action.',
  errorMessages: ['EthicalGate blocked by policy'],
});
assert.ok(safety.failureClasses.includes('safety-block'));
assert.match(safety.hypotheses[0], /hard constraint/);
assert.match(safety.nextExperiments[0], /Pause performance optimization/);

assert.throws(() => engine.diagnoseLearningAttempt({
  taskId: 'task-21', objective: 'Validate input', outcome: 'success',
  observedBehavior: 'ok', errorMessages: 'not-an-array',
}), /errors-must-be-array/);
assert.throws(() => engine.diagnoseLearningAttempt({
  taskId: 'task-22', objective: 'Validate input', outcome: 'maybe',
}), /outcome-invalid/);
assert.throws(() => engine.diagnoseLearningAttempt({
  taskId: '', objective: 'Validate input', outcome: 'unknown',
}), /task-id-required/);

let getterCalls = 0;
const accessorInput = {
  taskId: 'task-hostile',
  objective: 'Must not execute caller getters.',
  outcome: 'failure',
};
Object.defineProperty(accessorInput, 'observedBehavior', {
  enumerable: true,
  get() {
    getterCalls++;
    return 'forged result';
  },
});
assert.throws(
  () => engine.diagnoseLearningAttempt(accessorInput),
  /snapshot-accessor-invalid/,
  'untrusted evidence with accessors must be rejected at the trust boundary',
);
assert.equal(getterCalls, 0, 'snapshot validation must not execute caller getters');

console.log('P23_LEARNING_ATTEMPT_DIAGNOSIS=PASS trustBoundary=true promotionEligible=false');
