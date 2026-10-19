import assert from 'node:assert/strict';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const env = new WorldEnvironment();
// The initial state is home. Collecting there should fail because the notebook
// remains visible/collectable only after observe; move to lab then collect
// terminal once, then attempt another collect to force the negative reward.
env.step('move');
env.step('collect');
const failed = env.step('collect');

assert.equal(failed.rawReward, -0.04, 'negative raw reward must remain signed');
assert.equal(failed.reward, -0.04, 'functional reward must remain signed');
assert.equal(failed.displayReward01, 0.48, 'display reward may normalize to 0..1');

console.log('WORLD_REWARD_SEMANTICS=PASS', JSON.stringify({
  rawReward: failed.rawReward,
  reward: failed.reward,
  displayReward01: failed.displayReward01,
}));
