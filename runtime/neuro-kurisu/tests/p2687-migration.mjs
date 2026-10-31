import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { defaultExperienceContinuum } from '../src/organism/memory/ExperienceContinuumFabric.ts';

assert.ok(ORGANISM_STATE_SCHEMA >= 195, `schema must not regress below 195`);
assert.equal(RELEASE_CONTRACT.stateSchema, ORGANISM_STATE_SCHEMA);
const base=defaultExperienceContinuum();
const legacy={
  schemaVersion:194,
  state:{version:194},
  facets:{advanced:{experienceContinuum:{version:6,cycles:12,graphNodes:[{memoryId:'legacy-1',id:'experience:legacy-1',stability01:.6,replayPriority01:.5,lastReplayedAt:0,activeGoalIds:[]}]} }},
  system:{release:'35.6.86',organismCore:'92.4.0-causal-domain-closure-p2686',schemaVersion:194}
};
const migrated=migratePersistedOrganism(legacy);
const experience=migrated.facets.advanced.experienceContinuum;
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(experience.version,7);
assert.equal(experience.graphNodes.length,1);
assert.equal(experience.graphNodes[0].replayCount,0);
assert.deepEqual(experience.adaptiveReplayGovernor.laneCounts,base.adaptiveReplayGovernor.laneCounts);
assert.equal(experience.adaptiveReplayGovernor.version,1);
for(const value of Object.values(experience.adaptiveReplayGovernor.policyWeights)) assert(value>0 && value<=1);
console.log(JSON.stringify({pass:true,status:'P2687_MIGRATION_PASS',schemaFrom:194,schemaTo:migrated.schemaVersion,experienceVersion:experience.version,adaptiveReplayVersion:experience.adaptiveReplayGovernor.version},null,2));
