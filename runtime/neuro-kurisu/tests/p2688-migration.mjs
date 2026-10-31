import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { defaultExperienceContinuum } from '../src/organism/memory/ExperienceContinuumFabric.ts';

assert.ok(ORGANISM_STATE_SCHEMA >= 196, `schema must not regress below 196`);
assert.equal(RELEASE_CONTRACT.stateSchema, ORGANISM_STATE_SCHEMA);
const base=defaultExperienceContinuum();
const legacy={
  schemaVersion:195,
  state:{version:195},
  facets:{advanced:{experienceContinuum:{version:7,cycles:20,graphNodes:[{memoryId:'legacy-1',id:'experience:legacy-1',stability01:.6,replayPriority01:.5,lastReplayedAt:0,activeGoalIds:[],replayCount:4}],causalReplayCredit:{assignments:3,verifiedAssignments:2,recent:[{id:'x'},{id:'y'},{id:'z'}]}}}},
  system:{release:'35.6.87',organismCore:'92.5.0-adaptive-replay-multitimescale-p2687',schemaVersion:195}
};
const migrated=migratePersistedOrganism(legacy);
const experience=migrated.facets.advanced.experienceContinuum;
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(experience.version,7);
assert.equal(experience.graphNodes[0].replayCount,4);
assert.equal(experience.causalReplayCredit.assignments,3);
assert.equal(experience.causalReplayCredit.verifiedAssignments,2);
assert.deepEqual(experience.causalReplayCredit.recent.map(x=>x.id),['x','y','z']);
assert.deepEqual(experience.adaptiveReplayGovernor.laneCounts,base.adaptiveReplayGovernor.laneCounts);
console.log(JSON.stringify({pass:true,status:'P2688_MIGRATION_PASS',schemaFrom:195,schemaTo:migrated.schemaVersion,causalReplayCredit:experience.causalReplayCredit},null,2));
