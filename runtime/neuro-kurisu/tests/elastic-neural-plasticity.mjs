import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';
import { P29LearningGovernanceEngine } from '../src/organism/learning/P29LearningGovernance.ts';
import { DevelopmentalNeuralRuntime } from '../src/organism/core/DevelopmentalNeuralRuntime.ts';

const DIM = 18;
const vector = (index, value = 1) => {
  const features = new Array(DIM).fill(0);
  features[index] = value;
  return features;
};
const holdout = (prefix, action, index, value, target01, count = 4) =>
  Array.from({ length: count }, (_, i) => ({
    id: prefix + '-' + i,
    action,
    features: vector(index, value),
    target01,
  }));
const options = (overrides = {}) => ({
  trainingSampleId: 'train-energy-001',
  allowedParameterNames: ['energy', 'novelty', 'identityCoherence', 'actionCost'],
  protectedParameterNames: ['novelty'],
  targetHoldout: holdout('new-task', 'respond', 0, .9, 1),
  retentionHoldout: holdout('retained-task', 'respond', 1, .8, .5),
  maxCoordinates: 1,
  maxTrainableFraction01: .15,
  maxDeltaL2: .2,
  ...overrides,
});

// New-task skill improves, while the held-out old competence is unchanged.
const learner = new ParametricPolicyLearner();
const before = learner.snapshot();
const result = learner.trainFeaturesElastic({
  sampleId: 'train-energy-001',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
  sampleWeight01: 1,
}, options());

assert.equal(result.accepted, true, 'expected accepted sparse update, got ' + result.reason);
assert.deepEqual(result.updatedParameterNames, ['energy']);
assert.equal(result.updatedParameterNames.length, 1, 'one sparse coordinate should be updated');
const after = learner.snapshot();
assert.notEqual(after.weights.respond[0], before.weights.respond[0]);
assert.equal(after.weights.respond[1], before.weights.respond[1], 'unselected cognitiveLoad weight must remain unchanged');
assert.equal(after.weights.respond[3], before.weights.respond[3], 'explicitly protected novelty weight must remain unchanged');
assert.equal(after.weights.respond[8], before.weights.respond[8], 'identity-coherence weight is hard-protected');
assert.equal(after.weights.respond[17], before.weights.respond[17], 'action-cost weight is hard-protected');
assert.deepEqual(after.bias, before.bias, 'elastic feature updates must not shift action-wide bias');
for (const action of learner.actionList().filter((name) => name !== 'respond')) {
  assert.deepEqual(after.weights[action], before.weights[action], action + ' weights must remain untouched');
}
assert.ok(result.targetLossAfter01 < result.targetLossBefore01, 'new-task holdout loss must improve');
assert.ok(result.retentionLossAfter01 <= result.retentionLossBefore01 + .0005, 'retained competence must not regress');
assert.equal(after.elasticNeuralPlasticity.acceptedUpdates, 1);
assert.equal(after.elasticNeuralPlasticity.rejectedUpdates, 0);

// A candidate that improves the new-task holdout but damages an old skill is rejected atomically.
const guarded = new ParametricPolicyLearner();
const seeded = guarded.snapshot();
seeded.weights.respond[0] = .5;
guarded.restore(seeded);
const guardedBefore = guarded.snapshot();
const rejected = guarded.trainFeaturesElastic({
  sampleId: 'train-conflicting-001',
  features: vector(0),
  action: 'respond',
  target01: 0,
  learningRate01: .25,
}, options({
  trainingSampleId: 'train-conflicting-001',
  targetHoldout: holdout('new-opposite-task', 'respond', 0, .9, 0),
  retentionHoldout: holdout('old-energy-skill', 'respond', 0, .9, .9),
  maxRetentionLossIncrease01: .0001,
}));
assert.equal(rejected.accepted, false);
assert.equal(rejected.reason, 'retention-regression');
assert.deepEqual(guarded.snapshot().weights, guardedBefore.weights, 'rejected update must not mutate any policy weight');
assert.deepEqual(guarded.snapshot().bias, guardedBefore.bias);
assert.equal(guarded.snapshot().elasticNeuralPlasticity.rejectedUpdates, 1);
assert.ok(guarded.snapshot().elasticNeuralPlasticity.importanceByAction.respond[0] > 0,
  'ablation-derived importance must record the retained energy dependency');

// Safety-critical coordinates cannot be made trainable by the caller's allowlist.
const hardProtected = new ParametricPolicyLearner();
const protectedBefore = hardProtected.snapshot();
const protectedResult = hardProtected.trainFeaturesElastic({
  sampleId: 'train-protected-001',
  features: vector(8),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
}, options({
  allowedParameterNames: ['identityCoherence', 'actionCost'],
  protectedParameterNames: [],
  targetHoldout: holdout('protected-target', 'respond', 8, .9, 1),
  retentionHoldout: holdout('protected-retention', 'respond', 8, .9, .5),
}));
assert.equal(protectedResult.accepted, false);
assert.equal(protectedResult.reason, 'no-eligible-parameters');
assert.deepEqual(hardProtected.snapshot().weights, protectedBefore.weights);

// The train sample identity must be the same identity bound to the candidate's holdout envelope.
const identityBefore = hardProtected.snapshot();
assert.throws(() => hardProtected.trainFeaturesElastic({
  sampleId: 'actual-training-sample',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
}, options({
  trainingSampleId: 'different-training-sample',
})), /plasticity-training-sample-id-mismatch/);
assert.deepEqual(hardProtected.snapshot(), identityBefore);

// Train/holdout overlap is a hard input error and must be rejected before state changes.
const leakageBefore = hardProtected.snapshot();
assert.throws(() => hardProtected.trainFeaturesElastic({
  sampleId: 'same-id',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
}, options({
  trainingSampleId: 'same-id',
  targetHoldout: [{ id: 'same-id', action: 'respond', features: vector(0), target01: 1 }, ...holdout('new-task', 'respond', 0, .9, 1, 3)],
})), /holdout-id-overlap/);
assert.deepEqual(hardProtected.snapshot(), leakageBefore);

// Plasticity importance and decision counters survive the existing policy persistence boundary.
const restarted = new ParametricPolicyLearner();
restarted.restore(after);
assert.deepEqual(restarted.snapshot().elasticNeuralPlasticity, after.elasticNeuralPlasticity);
assert.deepEqual(restarted.snapshot().weights, after.weights);

// A committed sample ID remains consumed after a process restart.
const replayAfterRestart = restarted.trainFeaturesElastic({
  sampleId: 'train-energy-001',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
}, options({ trainingSampleId: 'train-energy-001' }));
assert.equal(replayAfterRestart.accepted, false);
assert.equal(replayAfterRestart.reason, 'duplicate-training-sample');

// Staging is side-effect-free; an ordinary training update invalidates a stale proposal.
const staged = new ParametricPolicyLearner();
const stagedInput = {
  sampleId: 'train-staged-001',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
};
const stagedBefore = staged.snapshot();
const stagedProposal = staged.proposeFeaturesElastic(
  stagedInput,
  options({ trainingSampleId: stagedInput.sampleId }),
);
assert.equal(stagedProposal.eligible, true);
assert.ok(stagedProposal.proposalId);
assert.deepEqual(staged.snapshot().weights, stagedBefore.weights, 'prepare must not mutate live policy weights');
const regularTraining = staged.trainFeatures({
  features: vector(1),
  action: 'respond',
  target01: .8,
  learningRate01: .1,
});
const afterRegularTraining = staged.snapshot();
assert.notDeepEqual(afterRegularTraining.weights, stagedBefore.weights);
const staleCommit = staged.commitFeaturesElastic(stagedProposal.proposalId);
assert.equal(staleCommit.accepted, false);
assert.equal(staleCommit.reason, 'stale-policy-base');
assert.deepEqual(staged.snapshot().weights, afterRegularTraining.weights,
  'stale candidate must not overwrite a newer policy generation');


const frozen = new ParametricPolicyLearner();
frozen.setFrozen(true);
const frozenBefore = frozen.snapshot();
const frozenResult = frozen.trainFeaturesElastic({
  sampleId: 'train-frozen-001',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
}, options({
  trainingSampleId: 'train-frozen-001',
}));
assert.equal(frozenResult.accepted, false);
assert.equal(frozenResult.reason, 'policy-frozen');
assert.deepEqual(frozen.snapshot().weights, frozenBefore.weights);

const p29 = new P29LearningGovernanceEngine();
const p26 = new P26TrueLearningEngine();
const p26Input = {
  sampleId: 'p26-elastic-train-001',
  features: vector(0),
  action: 'respond',
  target01: 1,
  learningRate01: .25,
};
const p26Options = options({ trainingSampleId: p26Input.sampleId });
const p26Result = p26.trainFeaturesElastic(p26Input, p26Options, p29);
assert.equal(p26Result.accepted, true, 'P26 must commit through the canonical P29 learning arbiter');
const p26State = p26.snapshot();
assert.equal(p26State.metrics.onlineUpdates, 1);
assert.equal(p26State.metrics.independentHoldoutSamples, 0, 'local holdout pairs must not forge independent evidence');
assert.notEqual(p26State.policy.weights.respond[0], 0);
assert.equal(p26State.policy.elasticNeuralPlasticity.acceptedUpdates, 1);
assert.equal(p29.snapshot().acceptedUpdates, 1, 'P29 must account for the accepted elastic policy change');
assert.equal(p29.snapshot().provenance.at(-1).source, 'p26-policy');
assert.equal(p29.snapshot().provenance.at(-1).accepted, true);

// A training sample may be consumed only once, even when the same call is replayed.
const duplicate = p26.trainFeaturesElastic(p26Input, p26Options, p29);
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, 'duplicate-training-sample');
assert.equal(p26.snapshot().metrics.onlineUpdates, 1, 'duplicate evidence must not train twice');

// The last accepted elastic change has a durable, one-shot rollback snapshot.
const beforeRollback = p26.snapshot().policy.weights.respond[0];
const rolledBack = p26.rollbackElasticPlasticity('respond', p29);
assert.equal(rolledBack.rolledBack, true);
assert.equal(p26.snapshot().policy.weights.respond[0], 0);
assert.notEqual(beforeRollback, 0);
assert.equal(p29.snapshot().provenance.at(-1).reason, 'elastic-plasticity-rollback');
const secondRollback = p26.rollbackElasticPlasticity('respond', p29);
assert.equal(secondRollback.rolledBack, false, 'rollback receipt must be consumed once');
assert.equal(secondRollback.reason, 'rollback-not-available');


// P29 exhaustion must fail closed before candidate weights mutate.
const deniedGovernance = new P29LearningGovernanceEngine();
deniedGovernance.setResourceBudget(0, 0);
const deniedEngine = new P26TrueLearningEngine();
const deniedBefore = deniedEngine.snapshot();
const denied = deniedEngine.trainFeaturesElastic({
  ...p26Input,
  sampleId: 'p26-elastic-budget-denied',
}, options({ trainingSampleId: 'p26-elastic-budget-denied' }), deniedGovernance);
assert.equal(denied.accepted, false);
assert.equal(denied.reason, 'governance-budget-rejected');
assert.deepEqual(deniedEngine.snapshot().policy.weights, deniedBefore.policy.weights);
assert.equal(deniedEngine.snapshot().metrics.onlineUpdates, 0);
assert.equal(deniedGovernance.snapshot().rejectedUpdates, 1);
assert.equal(deniedGovernance.snapshot().provenance.at(-1).accepted, false);

// The organism composition root routes elastic learning through P29 and persists its rollback state.
const developmentalRuntime = new DevelopmentalNeuralRuntime();
const runtimeInput = { ...p26Input, sampleId: 'runtime-elastic-train-001' };
const runtimeResult = developmentalRuntime.trainElasticNeuralPolicy(runtimeInput, options({ trainingSampleId: runtimeInput.sampleId }));
assert.equal(runtimeResult.accepted, true);
const hotSnapshot = developmentalRuntime.snapshotHotNeuralPersistenceState();
assert.equal(hotSnapshot.p26TrueLearning.policy.elasticNeuralPlasticity.acceptedUpdates, 1);
assert.equal(hotSnapshot.p29Learning.acceptedUpdates, 1);
assert.ok(hotSnapshot.p28Plasticity);
assert.ok(hotSnapshot.p30Continual);
const restoredRuntime = new DevelopmentalNeuralRuntime();
restoredRuntime.restoreHotNeuralLearningState(hotSnapshot);
assert.equal(restoredRuntime.p26TrueLearning.snapshot().policy.weights.respond[0], hotSnapshot.p26TrueLearning.policy.weights.respond[0]);
assert.equal(restoredRuntime.p29Learning.snapshot().acceptedUpdates, 1);
const runtimeRollback = restoredRuntime.rollbackElasticNeuralPolicy('respond');
assert.equal(runtimeRollback.rolledBack, true);
assert.equal(restoredRuntime.p26TrueLearning.snapshot().policy.weights.respond[0], 0);
console.log('ELASTIC_NEURAL_PLASTICITY=PASS sparse=1 protected=3 retentionGate=PASS leakageGate=PASS persistence=PASS frozen=PASS');
