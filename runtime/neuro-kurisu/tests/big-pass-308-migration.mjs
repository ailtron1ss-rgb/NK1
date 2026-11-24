import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const legacy={
  schemaVersion:127,
  facets:{learning:{adaptivePolicy:{
    version:1, values:{legacy:{explore:{value:.74,updates:6,rewardMean:.7,rewardVariance:.09,confidence01:.5,lastUpdatedAt:1}}},
    updates:6,rewardedUpdates:4,penalizedUpdates:1,explorationRate01:.18,lastContextKey:'legacy',lastAction:'explore',lastUpdateAt:1
  }}}
};
const migrated=migratePersistedOrganism(legacy);
const policy=migrated.facets.learning.adaptivePolicy;
const row=policy.values.legacy.explore;
assert.ok(row,'legacy adaptive policy row missing after migration');
assert.equal(row.verifiedUpdates,0,'legacy verifiedUpdates should default to zero');
assert.equal(row.eligibility01,0,'legacy eligibility should default to zero');
assert.equal(policy.temporalCreditUpdates,0,'legacy temporal credit counter should default to zero');
assert.equal(policy.verifiedTemporalUpdates,0,'legacy verified temporal counter should default to zero');
assert.equal(policy.temporalPriorAction,'none','legacy temporal prior action should default to none');
console.log(JSON.stringify({pass:true,schema:migrated.schemaVersion,row:{verifiedUpdates:row.verifiedUpdates,eligibility01:row.eligibility01},policy:{temporalCreditUpdates:policy.temporalCreditUpdates,verifiedTemporalUpdates:policy.verifiedTemporalUpdates,temporalPriorAction:policy.temporalPriorAction}},null,2));
