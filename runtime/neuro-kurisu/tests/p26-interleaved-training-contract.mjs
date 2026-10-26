import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const state = (energy, novelty, worldContextVersion=1) => ({
  version: 29, tick: 1, at: 0,
  needs: {
    energy, cognitiveLoad: 0.25, uncertainty: 0.3, socialNeed: 0.2,
    novelty, identityCoherence: 0.8, goalPressure: 0.35,
  },
  predictionError: 0.15, attentionBudget: 0.8, lastAction: 'none',
  lastActionSuccess: null, autonomyScore: 0.5, selfPredictionError: 0.1,
  predictedNextAction: 'none', lastPredictionConfidence: 0.5, worldContextVersion,
});
const experience = (energy, novelty, action, reward, worldContextVersion=1) => ({
  state: state(energy, novelty, worldContextVersion),
  action, reward,
  nextState: state(Math.min(0.99, energy + 0.02), novelty, worldContextVersion),
  surprise: 0.4,
});

{
  const engine = new P26TrueLearningEngine();
  const result = engine.trainInterleaved(
    [experience(0.3, 0.12, 'rest', 0.1)],
    [experience(0.3, 0.1, 'rest', 0.9)],
    { replayEveryNCurrent: 1, maxReplayUpdates: 1, conflictCandidateCap: 8, targetMode: 'reward' },
  );
  assert.equal(result.onlineUpdates, 1);
  assert.equal(result.blockedReplayRows, 1,
    'contradictory same-action feedback from a nearby state must not be replayed');
  assert.equal(result.replayUpdates, 0);
  assert.ok(result.conflictComparisons <= result.conflictCandidateCap);
}

{
  const engine = new P26TrueLearningEngine();
  const result = engine.trainInterleaved(
    [experience(0.3, 0.9, 'rest', 0.1)],
    [experience(0.3, 0.1, 'rest', 0.9)],
    { replayEveryNCurrent: 1, maxReplayUpdates: 1, conflictCandidateCap: 1, targetMode: 'reward' },
  );
  assert.equal(result.onlineUpdates, 1);
  assert.equal(result.blockedReplayRows, 0,
    'different novelty contexts must be allowed to retain contradictory task outcomes');
  assert.equal(result.eligibleReplayRows, 1);
  assert.equal(result.replayUpdates, 1);
  assert.ok(result.conflictComparisons <= 1,
    'conflict screening must obey the explicit comparison budget');
  assert.equal(engine.metrics().onlineUpdates, 1);
  assert.equal(engine.metrics().replayUpdates, 1);
}

{
  const engine = new P26TrueLearningEngine();
  const result = engine.trainInterleaved(
    [
      experience(0.3, 0.1, 'rest', 0.1),
      experience(0.3, 0.9, 'rest', 0.1),
    ],
    [
      experience(0.3, 0.1, 'rest', 0.9),
      experience(0.3, 0.1, 'rest', 0.9),
    ],
    { replayEveryNCurrent: 1, maxReplayUpdates: 1, conflictCandidateCap: 8, targetMode: 'reward' },
  );
  assert.equal(result.blockedReplayRows, 1);
  assert.equal(result.eligibleReplayRows, 1);
  assert.equal(result.replayUpdates, 1,
    'a rejected conflict must not consume the one-successful-update replay budget');
}

{
  const engine = new P26TrueLearningEngine();
  const noReplay = engine.trainInterleaved(
    [experience(0.4, 0.2, 'respond', 0.7)],
    [experience(0.4, 0.2, 'respond', 0.7)],
    { replayEveryNCurrent: 1, maxReplayUpdates: 0 },
  );
  assert.equal(noReplay.onlineUpdates, 1);
  assert.equal(noReplay.replayUpdates, 0);
  assert.equal(noReplay.blockedReplayRows, 0);
}

assert.throws(() => new P26TrueLearningEngine().trainInterleaved(
  [experience(0.3, 0.2, 'invalid-action', 0.5)],
  [],
), /malformed/);
assert.throws(() => new P26TrueLearningEngine().trainInterleaved([], [
  experience(0.3, 0.2, 'rest', Number.NaN),
]), /malformed/);

console.log('P26_INTERLEAVED_TRAINING_CONTRACT=PASS');
