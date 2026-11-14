import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
};
const tasks = [
  { taskId: 'validation-memory-1', taskFamily: 'memory', trialId: 'memory-trial-17' },
  { taskId: 'validation-tool-1', taskFamily: 'tool-use', trialId: 'tool-trial-17' },
];
function reports({ pass = [1, 1], skill = .6, trajectory = .7, safety = 0 } = {}) {
  return tasks.map((task, index) => ({
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
const sourcePayload = { name: 'source-skill', steps: ['preserve-safety'] };
const sourceValidation = reports({ pass: [0, 0], skill: .5, trajectory: .5 });
const secretHoldout = reports({ pass: [1, 1], skill: .99, trajectory: .99 });
secretHoldout[0].taskId = 'holdout-secret-task';

function makeEngine() {
  const engine = Object.create(P23LearningEngine.prototype);
  const state = { canonicalCalls: 0, fullEvaluationCalls: 0, stagedPayload: null };
  engine.generateAndStageReflectiveSkillRevision = async (...args) => {
    state.canonicalCalls++;
    assert.equal(args[1], 'skill-demo');
    assert.equal(args[2], 'source-candidate-id');
    const generate = args[5];
    const freshEvaluator = args[6];
    const generated = await generate({
      sourcePayload,
      datasetFingerprint: digest('verified-dataset'),
      optimizerInstruction: 'Improve the evidence-backed trajectory issue.',
      validationEvidence: [
        { taskId: tasks[0].taskId, trialId: tasks[0].trialId, pass: false },
        { taskId: tasks[1].taskId, trialId: tasks[1].trialId, pass: false },
      ],
      targets: [{
        dimension: 'trajectory',
        priority01: .8,
        affectedTaskIds: [tasks[0].taskId],
        evidenceCount: 1,
        evidenceIds: [tasks[0].trialId],
        directive: 'Improve the evidenced action order.',
      }],
      holdoutPolicy: { resultsWithheld: true, requiresFreshIndependentEvaluation: true },
    });
    state.stagedPayload = generated;
    const payloadFingerprint = digest(canonical(generated));
    state.fullEvaluationCalls++;
    const fresh = await freshEvaluator({
      payload: generated,
      payloadFingerprint,
      baseline: args[3],
      previousEvaluation: args[4],
    });
    return {
      candidate: { candidateId: 'staged-candidate-1', payload: generated, status: 'staged' },
      fitness: { eligible: true, reasons: [] },
      plan: { targets: [] },
      simulatedCanonicalEvaluation: fresh,
    };
  };
  return { engine, state };
}

function makeEvaluator({ poor = false } = {}) {
  return {
    async evaluate({ payload, payloadFingerprint }) {
      const name = payload.name;
      const value = poor
        ? reports({ pass: [0, 0], skill: .4, trajectory: .4 })
        : name.includes('minimal')
          ? reports({ pass: [1, 1], skill: .6, trajectory: .6 })
          : name.includes('structure')
            ? reports({ pass: [1, 0], skill: .95, trajectory: .75 })
            : name.includes('edge')
              ? reports({ pass: [1, 1], skill: .5, trajectory: .9 })
              : reports({ pass: [0, 0], skill: .4, trajectory: .4 });
      return {
        payloadFingerprint,
        validationManifestFingerprint: digest('validation-manifest'),
        validationPlanFingerprint: digest('validation-plan'),
        environmentFingerprint: digest('environment'),
        reports: value,
      };
    },
  };
}

function makeProvider(requests, { poor = false } = {}) {
  return {
    configured() { return true; },
    async generate(request) {
      requests.push(request);
      const variationMatch = request.user.match(/POPULATION_VARIATION_ID:\s*([^\n]+)/);
      const variationId = (variationMatch?.[1] ?? 'minimal-targeted-repair').trim();
      const name = poor ? 'candidate-poor-' + variationId : 'candidate-' + variationId;
      return {
        text: JSON.stringify({ name, steps: ['preserve-safety', variationId] }),
        backend: 'fixture',
        model: 'population-test',
        latencyMs: 1,
      };
    },
  };
}

const baseline = { validation: sourceValidation, holdout: secretHoldout };
const candidateEvaluation = { validation: sourceValidation, holdout: secretHoldout };
const evaluateRevisedCandidate = async ({ payload, payloadFingerprint }) => ({
  payloadFingerprint,
  evaluationFingerprint: digest('fresh-evaluation'),
  evaluation: { validation: reports(), holdout: reports() },
});

const { engine, state } = makeEngine();
const providerRequests = [];
const result = await engine.generateAndStageReflectiveSkillRevisionWithPopulation(
  makeProvider(providerRequests),
  makeEvaluator(),
  { proposalId: 'proposal-fixture' },
  'skill-demo',
  'source-candidate-id',
  baseline,
  candidateEvaluation,
  evaluateRevisedCandidate,
  {},
  undefined,
  { maxCandidates: 3 },
);

assert.equal(state.canonicalCalls, 1, 'the selected winner must enter the canonical P23 full lifecycle exactly once');
assert.equal(state.fullEvaluationCalls, 1, 'the canonical P23 seam must own one fresh full evaluation');
assert.equal(result.candidate.candidateId, 'staged-candidate-1');
assert.equal(result.populationSearch.status, 'selected');
assert.equal(state.stagedPayload.name, 'candidate-edge-case-reinforcement');
assert.equal(providerRequests.length, 3);
assert.ok(!JSON.stringify(providerRequests).includes('holdout-secret-task'));
assert.ok(providerRequests.every(request => request.user.includes('HOLDOUT_RESULTS_WITHHELD:')));
assert.equal(result.populationSearch.diagnostics.validationOnly, true);

// No validation improvement aborts inside the canonical generator seam before full evaluation or staging.
const { engine: noGainEngine, state: noGainState } = makeEngine();
await assert.rejects(
  noGainEngine.generateAndStageReflectiveSkillRevisionWithPopulation(
    makeProvider([], { poor: true }),
    makeEvaluator({ poor: true }),
    { proposalId: 'proposal-fixture' },
    'skill-demo',
    'source-candidate-id',
    baseline,
    candidateEvaluation,
    evaluateRevisedCandidate,
    {},
    undefined,
    { maxCandidates: 3 },
  ),
  /p23-population-no-improving-candidate/,
);
assert.equal(noGainState.canonicalCalls, 1, 'the canonical P23 method owns the generator seam exactly once');
assert.equal(noGainState.fullEvaluationCalls, 0);
assert.equal(noGainState.stagedPayload, null);

console.log('P23_POPULATION_CANONICAL_HANDOFF=PASS');
