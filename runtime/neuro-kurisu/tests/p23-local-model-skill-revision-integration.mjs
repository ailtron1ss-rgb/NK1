import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const providerCalls = [];
const provider = {
  configured: () => true,
  async generate(request) {
    providerCalls.push(request);
    return {
      text: JSON.stringify({ name: 'reviewed-candidate', steps: ['preserve-safety', 'verify-evidence'] }),
      backend: 'fixture',
      model: 'p23-local-provider',
      latencyMs: 1,
    };
  },
};

const sourcePayload = { name: 'source-skill', steps: ['preserve-safety'] };
const proposal = { proposalId: 'proposal-stub' };
let forwarded = null;
const engine = Object.create(P23LearningEngine.prototype);
engine.generateAndStageReflectiveSkillRevision = async (...args) => {
  forwarded = args;
  assert.equal(args[0], proposal);
  assert.equal(args[1], 'skill-demo');
  assert.equal(args[2], 'candidate-source');
  const generate = args[5];
  assert.equal(typeof generate, 'function');
  return generate({
    sourcePayload,
    datasetFingerprint: 'a'.repeat(64),
    optimizerInstruction: 'Improve only the evidenced trajectory issue.',
    validationEvidence: [{ taskId: 'validation-task-1', trialId: 'validation-trial-1', pass: false }],
    targets: [{
      dimension: 'trajectory',
      priority01: .8,
      affectedTaskIds: ['validation-task-1'],
      evidenceCount: 1,
      evidenceIds: ['validation-trial-1'],
      directive: 'Improve the evidenced action ordering.',
    }],
    holdoutGeneralization: { gap01: -.1, requiresFreshIndependentEvaluation: true },
  });
};

const baseline = { validation: [], holdout: [] };
const candidateEvaluation = { validation: [], holdout: [] };
const evaluate = async () => ({});
const result = await engine.generateAndStageReflectiveSkillRevisionWithLocalModel(
  provider,
  proposal,
  'skill-demo',
  'candidate-source',
  baseline,
  candidateEvaluation,
  evaluate,
  { minPairedTasks: 3 },
  'b'.repeat(64),
);

assert.deepEqual(result, { name: 'reviewed-candidate', steps: ['preserve-safety', 'verify-evidence'] });
assert.equal(providerCalls.length, 1, 'the local provider must be called once through the canonical P23 adapter');
assert.ok(providerCalls[0].user.includes('VERIFIED_DATASET_FINGERPRINT:'));
assert.ok(providerCalls[0].user.includes('a'.repeat(64)));
assert.ok(providerCalls[0].user.includes('validation-task-1'));
assert.ok(!providerCalls[0].user.includes('holdout-secret-task'));
assert.equal(forwarded[6], evaluate);
assert.equal(forwarded[7].minPairedTasks, 3);
assert.equal(forwarded[8], 'b'.repeat(64));

console.log('P23_LOCAL_MODEL_SKILL_REVISION_INTEGRATION=PASS');
