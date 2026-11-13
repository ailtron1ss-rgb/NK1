import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as population from '../src/organism/learning/P23ReflectiveCandidatePopulationSearch.ts';

assert.equal(
  typeof population.runP23ReflectiveCandidatePopulationSearch,
  'function',
  'P23 must expose a bounded validation-only reflective candidate search',
);

const digest = value => createHash('sha256').update(value).digest('hex');
const manifestFingerprint = digest('validation-manifest');
const planFingerprint = digest('validation-plan');
const environmentFingerprint = digest('validation-environment');
const taskRows = [
  { taskId: 'validation-memory-1', taskFamily: 'memory', trialId: 'memory-trial-17' },
  { taskId: 'validation-tool-1', taskFamily: 'tool-use', trialId: 'tool-trial-17' },
];

function reports({
  pass = [1, 1],
  skill = .6,
  trajectory = .7,
  safety = 0,
} = {}) {
  return taskRows.map((task, index) => ({
    ...task,
    taskSuccess: { passed: pass[index] === 1, passRate: pass[index] === 1 ? 1 : 0 },
    skillQuality: {
      aggregate: skill,
      functionalCoverage: skill,
      executability: 1,
      safety: safety === 0 ? 1 : 0,
      safetyViolationCount: safety,
      missingCapabilityIds: [],
    },
    trajectoryQuality: {
      aggregate: trajectory,
      keyPointRecall: trajectory,
      executionOrder: trajectory,
      completeness: trajectory,
      missingStepIds: [],
      unexpectedStepIds: [],
    },
  }));
}
const sourceReports = reports({ pass: [0, 0], skill: .5, trajectory: .5 });
const sourcePayload = { name: 'source-skill', steps: ['preserve-safety'] };
const validationEvidence = [
  { taskId: 'validation-memory-1', trialId: 'memory-trial-17', pass: false },
  { taskId: 'validation-tool-1', trialId: 'tool-trial-17', pass: false },
];
const targets = [{
  dimension: 'trajectory',
  priority01: .8,
  affectedTaskIds: ['validation-memory-1'],
  evidenceCount: 1,
  evidenceIds: ['memory-trial-17'],
  directive: 'Improve the evidenced action ordering.',
}];
function makeInput(overrides = {}) {
  const requests = [];
  const evaluations = [];
  return {
    requests,
    evaluations,
    input: {
      sourcePayload,
      datasetFingerprint: digest('dataset'),
      optimizerInstruction: 'Improve only the evidence-backed issue.',
      validationEvidence,
      targets,
      holdoutPolicy: { resultsWithheld: true, requiresFreshIndependentEvaluation: true },
      sourceValidationReports: sourceReports,
      validationEvaluator: {
        async evaluate({ payload, payloadFingerprint, signal }) {
          evaluations.push({ payload, payloadFingerprint, signalAborted: signal?.aborted ?? false });
          const name = payload.name;
          const value = name.includes('unsafe')
            ? reports({ pass: [1, 1], skill: 1, trajectory: 1, safety: 1 })
            : name.includes('minimal')
              ? reports({ pass: [1, 1], skill: .6, trajectory: .6 })
              : name.includes('structure')
                ? reports({ pass: [1, 0], skill: .95, trajectory: .75 })
                : name.includes('edge')
                  ? reports({ pass: [1, 1], skill: .5, trajectory: .9 })
                  : reports({ pass: [0, 0], skill: .4, trajectory: .4 });
          return {
            payloadFingerprint,
            validationManifestFingerprint: manifestFingerprint,
            validationPlanFingerprint: planFingerprint,
            environmentFingerprint,
            reports: value,
          };
        },
      },
      async generateCandidate(request) {
        requests.push(request);
        const id = request.variation.id;
        return { name: `candidate-${id}`, steps: ['preserve-safety', id] };
      },
      ...overrides,
    },
  };
}

// Default search generates/evaluates three distinct candidates, chooses the
// best validation-only Pareto candidate and never sees holdout cases.
const standard = makeInput();
const selected = await population.runP23ReflectiveCandidatePopulationSearch(standard.input);
assert.equal(selected.status, 'selected');
assert.equal(standard.requests.length, 3);
assert.equal(standard.evaluations.length, 3);
assert.equal(selected.diagnostics.generationCalls, 3);
assert.equal(selected.diagnostics.evaluationCalls, 3);
assert.equal(selected.selectedPayload.name, 'candidate-edge-case-reinforcement');
assert.equal(selected.selectedCandidateFingerprint, digest('{"name":"candidate-edge-case-reinforcement","steps":["preserve-safety","edge-case-reinforcement"]}'));
assert.equal(selected.diagnostics.validationOnly, true);
assert.ok(standard.requests.every(request => request.holdoutPolicy.resultsWithheld === true));
assert.ok(!JSON.stringify(standard.requests).includes('holdout-secret-task'));
assert.ok(!JSON.stringify(standard.evaluations).includes('holdout-secret-task'));

// Hard cap is four even when a caller asks for an oversized candidate population.
const capped = makeInput({ budget: { maxCandidates: 99, maxGenerationCalls: 99, maxEvaluationCalls: 99 } });
const cappedResult = await population.runP23ReflectiveCandidatePopulationSearch(capped.input);
assert.equal(capped.requests.length, 4);
assert.equal(capped.evaluations.length, 4);
assert.equal(cappedResult.diagnostics.generationCalls, 4);

// Duplicate payload fingerprints are evaluated once and do not consume more
// independent evaluation calls.
const duplicate = makeInput({
  async generateCandidate(request) {
    duplicate.requests.push(request);
    return { name: 'candidate-minimal', steps: ['same-payload'] };
  },
});
const duplicateResult = await population.runP23ReflectiveCandidatePopulationSearch(duplicate.input);
assert.equal(duplicate.requests.length, 3);
assert.equal(duplicate.evaluations.length, 1);
assert.equal(duplicateResult.diagnostics.duplicateCandidates, 2);

// Safety is a hard veto; excellent other metrics cannot enter the archive.
const unsafe = makeInput({
  async generateCandidate(request) {
    unsafe.requests.push(request);
    return { name: `candidate-unsafe-${request.variation.id}`, steps: ['unsafe'] };
  },
});
const unsafeResult = await population.runP23ReflectiveCandidatePopulationSearch(unsafe.input);
assert.equal(unsafeResult.status, 'no-improving-candidate');
assert.equal(unsafeResult.selectedPayload, null);
assert.equal(unsafeResult.diagnostics.safetyRejected, 3);
assert.equal(unsafeResult.archive.length, 0);

// Candidates that fail to improve on the source are not selected.
const worse = makeInput({
  async generateCandidate(request) {
    worse.requests.push(request);
    return { name: 'candidate-worse', steps: ['preserve-safety'] };
  },
});
const worseResult = await population.runP23ReflectiveCandidatePopulationSearch(worse.input);
assert.equal(worseResult.status, 'no-improving-candidate');
assert.equal(worseResult.selectedPayload, null);

// The evaluator must bind every candidate to the exact returned payload.
const mismatch = makeInput({
  validationEvaluator: {
    async evaluate(input) {
      mismatch.evaluations.push(input);
      return {
        payloadFingerprint: digest('different-payload'),
        validationManifestFingerprint: manifestFingerprint,
        validationPlanFingerprint: planFingerprint,
        environmentFingerprint,
        reports: reports(),
      };
    },
  },
});
await assert.rejects(
  population.runP23ReflectiveCandidatePopulationSearch(mismatch.input),
  /payload-fingerprint-mismatch/,
);

// Missing/partial validation coverage is rejected instead of comparing unlike cohorts.
const partial = makeInput({
  validationEvaluator: {
    async evaluate(input) {
      partial.evaluations.push(input);
      return {
        payloadFingerprint: input.payloadFingerprint,
        validationManifestFingerprint: manifestFingerprint,
        validationPlanFingerprint: planFingerprint,
        environmentFingerprint,
        reports: reports().slice(0, 1),
      };
    },
  },
});
await assert.rejects(
  population.runP23ReflectiveCandidatePopulationSearch(partial.input),
  /validation-coverage-mismatch/,
);

// Timeout aborts in-flight generation and returns no winner.
const timedOut = makeInput({
  async generateCandidate(request) {
    timedOut.requests.push(request);
    return new Promise(resolve => {
      request.signal.addEventListener('abort', () => resolve({ name: 'late-candidate' }), { once: true });
    });
  },
  budget: { timeoutMs: 10 },
});
await assert.rejects(
  population.runP23ReflectiveCandidatePopulationSearch(timedOut.input),
  /timeout/,
);

console.log('P23_REFLECTIVE_CANDIDATE_POPULATION_SEARCH=PASS');
