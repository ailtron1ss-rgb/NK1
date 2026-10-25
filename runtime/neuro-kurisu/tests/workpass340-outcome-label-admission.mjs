import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const baseNeeds = (overrides = {}) => ({
  energy: .72, cognitiveLoad: .24, uncertainty: .42, socialNeed: .32,
  novelty: .45, identityCoherence: .86, goalPressure: .22, ...overrides,
});
const stateBefore = (overrides = {}) => ({
  version: 26, tick: 1, at: 1, needs: baseNeeds(overrides), predictionError: .2,
  attentionBudget: .8, lastAction: 'wait', lastActionSuccess: null, autonomyScore: .2,
  selfPredictionError: .1, predictedNextAction: 'reflect', lastPredictionConfidence: .6,
  worldContextVersion: 1,
});
const makeTrace = (tick = 1, action = 'verify', success = .8, overrides = {}) => ({
  id: `trace-${tick}`, tick, createdAt: tick,
  candidates: [{
    id: `c-${tick}`, goalId: undefined, action, score: .72, predictedUtility: .65,
    predictedNeedRelief: .5, predictedCost: .2, confidence: .7, generatedAt: tick,
  }],
  selected: {
    id: `c-${tick}`, goalId: undefined, action, score: .72, predictedUtility: .65,
    predictedNeedRelief: .5, predictedCost: .2, confidence: .7, generatedAt: tick,
  },
  stateBefore: stateBefore(overrides),
  reasoningSignals: {}, userRequestedAction: null, autonomousOverride: false,
  predictedOutcomes: [{
    action, utility: .65, confidence: .7, reasons: ['test'],
    nextState: { energy: .7, cognitiveLoad: .25, uncertainty: .4, novelty: .4 },
    worldEvidence: [],
  }],
  outcome: { success, reward: success, surprise: Math.abs(success - .65), at: tick + 1 },
});

function rejected(label, mutateTrace = trace => trace, outcome = { success: .8, reward: .8, surprise: .1 }) {
  const engine = new P23LearningEngine();
  const trace = mutateTrace(makeTrace(10));
  assert.doesNotThrow(
    () => engine.recordExperience(trace, trace?.stateBefore, outcome, new AdaptivePolicyEngine()),
    label + ': invalid inputs must fail closed without throwing',
  );
  assert.equal(engine.snapshot().experiences.length, 0, label + ': invalid inputs must not become learning examples');
  assert.equal(engine.snapshot().processedTraceIds.length, 0, label + ': rejected identity must not be marked processed');
  assert.equal(engine.snapshot().metrics.outcomes, 0, label + ': rejected feedback must not increment outcomes');
}

rejected('success below unit interval', undefined, { success: -0.01, reward: .5, surprise: .1 });
rejected('success above unit interval', undefined, { success: 1.01, reward: .5, surprise: .1 });
rejected('surprise above unit interval', undefined, { success: .8, reward: .8, surprise: 1.01 });
rejected('NaN surprise', undefined, { success: .8, reward: .8, surprise: Number.NaN });
rejected('infinite reward', undefined, { success: .8, reward: Number.POSITIVE_INFINITY, surprise: .1 });
rejected('prediction above unit interval', trace => {
  trace.selected.predictedUtility = 1.01;
  return trace;
});
rejected('non-finite confidence', trace => {
  trace.selected.confidence = Number.NaN;
  return trace;
});
rejected('negative tick', trace => {
  trace.tick = -1;
  return trace;
});
rejected('invalid observation timestamp', trace => {
  trace.createdAt = Number.NaN;
  return trace;
});
rejected('invalid action', trace => {
  trace.selected.action = 'delete-evidence';
  return trace;
});
rejected('malformed context state', trace => {
  trace.stateBefore.needs.energy = Number.NaN;
  return trace;
});
rejected('malformed candidate list', trace => {
  trace.candidates = [null];
  return trace;
});
rejected('malformed predicted outcomes', trace => {
  trace.predictedOutcomes = [null];
  return trace;
});
rejected('malformed identity', trace => {
  trace.id = 'trace-\n-injected';
  return trace;
});

const engine = new P23LearningEngine();
const policy = new AdaptivePolicyEngine();
const trace = makeTrace(31, 'verify', .8);
engine.recordExperience(trace, trace.stateBefore, { success: .8, reward: .7, surprise: .1 }, policy);
assert.equal(engine.snapshot().experiences.length, 1, 'well-formed observations remain learnable');
assert.equal(engine.snapshot().experiences[0].success, .8, 'valid success labels are preserved exactly');
assert.equal(engine.snapshot().experiences[0].surprise, .1, 'valid surprise labels are preserved exactly');

// Rejection must not consume an ID: a corrected, verified result can be admitted later.
const retryEngine = new P23LearningEngine();
const retryTrace = makeTrace(32, 'verify', .8);
retryEngine.recordExperience(retryTrace, retryTrace.stateBefore,
  { success: 1.5, reward: .7, surprise: .1 }, policy);
retryEngine.recordExperience(retryTrace, retryTrace.stateBefore,
  { success: .8, reward: .7, surprise: .1 }, policy);
assert.equal(retryEngine.snapshot().experiences.length, 1,
  'the same trace identity can be retried after malformed feedback has been rejected');
assert.deepEqual(retryEngine.snapshot().processedTraceIds, ['trace-32']);

assert.doesNotThrow(
  () => engine.recordExperience(null, null, null, policy),
  'JavaScript callers with malformed runtime arguments are rejected without partial writes',
);
console.log('WORKPASS340_P23_OUTCOME_LABEL_ADMISSION=PASS rangeChecks=true malformedTraceRejected=true invalidEvidenceNotConsumed=true');
