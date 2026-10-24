import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const net = new B272EndogenousGoalGenesis();
const generated = net.step({
  tick: 0,
  selfLatent: [0.2, -0.1, 0.3, 0.4],
  worldLatent: [0.1, 0.3, -0.2, 0.5],
  needs: { energy01: 0.7, uncertainty01: 0.4, novelty01: 0.5, goalPressure01: 0.3, socialNeed01: 0.2 },
  traits: { curiosity: 0.7, 'truth-seeking': 0.7, 'self-reflection': 0.6, 'self-preservation': 0.7, care: 0.6, 'social-attunement': 0.5, persistence: 0.7 },
  predictionError01: 0.3,
  autobiographicalContinuity01: 0.8,
  identityContinuity01: 0.8,
  intrinsicReward01: 0.2,
  lastAction: null,
  lastReward01: 0.5,
});

const executedAction = generated.action === 'explore' ? 'respond' : 'explore';
const beforeMismatch = net.snapshot();
assert.equal(net.recordOutcomeActionMismatch({ tick: 0, executedAction }), true);
const afterMismatch = net.snapshot();
assert.equal(afterMismatch.outcomeActionMismatches, 1);
assert.deepEqual(afterMismatch.lastOutcomeActionMismatch, {
  tick: 0,
  generatedAction: generated.action,
  executedAction,
});
assert.equal(afterMismatch.learningUpdates, beforeMismatch.learningUpdates,
  'mismatched policy action must not be credited to B272 learning');
assert.deepEqual(afterMismatch.actionPrototypeWeights, beforeMismatch.actionPrototypeWeights,
  'mismatch observation must not mutate B272 learned action weights');

assert.equal(net.recordOutcomeActionMismatch({ tick: 0, executedAction }), false,
  'duplicate mismatch evidence in one goal tick must not inflate diagnostics');
assert.equal(net.snapshot().outcomeActionMismatches, 1);

assert.throws(() => net.learnFromOutcome({
  tick: 0, action: executedAction, reward01: 0.9, predictionError01: 0.1, externalEvidence01: 1,
}), /action must match/,
  'B272 must continue rejecting false action attribution at its own contract boundary');

const persisted = net.snapshot();
const restored = new B272EndogenousGoalGenesis();
restored.restore(persisted);
assert.deepEqual(restored.snapshot().lastOutcomeActionMismatch, persisted.lastOutcomeActionMismatch,
  'action attribution evidence must persist across restore');
assert.equal(restored.snapshot().outcomeActionMismatches, 1);

const corrupt = structuredClone(persisted);
corrupt.outcomeActionMismatches = -1;
corrupt.lastOutcomeActionMismatch = {
  tick: Number.MAX_SAFE_INTEGER,
  generatedAction: 'execute-shell',
  executedAction: 'respond',
};
const sanitized = new B272EndogenousGoalGenesis();
sanitized.restore(corrupt);
assert.equal(sanitized.snapshot().outcomeActionMismatches, 0,
  'invalid mismatch counters must fail closed on restore');
assert.equal(sanitized.snapshot().lastOutcomeActionMismatch, null,
  'forged or out-of-range mismatch evidence must be quarantined');

const invalid = new B272EndogenousGoalGenesis();
invalid.step({
  tick: 0,
  selfLatent: [0.1],
  worldLatent: [0.2],
  needs: { energy01: 0.7, uncertainty01: 0.4, novelty01: 0.5, goalPressure01: 0.3, socialNeed01: 0.2 },
  traits: { curiosity: 0.7 },
  predictionError01: 0.3,
  autobiographicalContinuity01: 0.8,
  identityContinuity01: 0.8,
  intrinsicReward01: 0.2,
  lastAction: null,
  lastReward01: 0.5,
});
const prior = invalid.snapshot();
assert.throws(() => invalid.recordOutcomeActionMismatch({ tick: 1, executedAction: 'respond' }), /tick/);
assert.throws(() => invalid.recordOutcomeActionMismatch({ tick: 0, executedAction: 'execute-shell' }), /action/);
assert.deepEqual(invalid.snapshot(), prior,
  'invalid mismatch evidence must not mutate the goal state');

console.log('LOCAL_B272_ACTION_ATTRIBUTION=PASS', JSON.stringify({
  mismatchesObserved: true,
  noFalseLearningCredit: true,
  strictLearnerContractPreserved: true,
  persistenceAndRestore: true,
  invalidEvidenceRejected: true,
}));
