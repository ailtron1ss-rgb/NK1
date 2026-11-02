import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { defaultExperienceContinuum, ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

assert.equal(ORGANISM_STATE_SCHEMA,196);
assert.equal(RELEASE_CONTRACT.stateSchema,196);
const base=defaultExperienceContinuum();
const legacy={
  schemaVersion:195,
  state:{version:195},
  facets:{advanced:{experienceContinuum:{version:7,cycles:20,graphNodes:[{memoryId:'legacy-1',id:'experience:legacy-1',stability01:.6,replayPriority01:.5,lastReplayedAt:0,activeGoalIds:[],replayCount:4}],causalReplayCredit:{assignments:3,verifiedAssignments:2,recent:[{id:'x'},{id:'y'},{id:'z'}]}}}},
  system:{release:'35.6.87',organismCore:'92.5.0-adaptive-replay-multitimescale-p2687',schemaVersion:195}
};
const migrated=migratePersistedOrganism(legacy);
const experience=migrated.facets.advanced.experienceContinuum;
assert.equal(migrated.schemaVersion,196);
assert.equal(experience.version,7);
assert.equal(experience.graphNodes[0].replayCount,4);
assert.equal(experience.causalReplayCredit.assignments,3);
assert.equal(experience.causalReplayCredit.verifiedAssignments,2,'legacy migration keeps raw diagnostic metadata intact');
assert.deepEqual(experience.causalReplayCredit.recent.map(x=>x.id),['x','y','z']);
const restoredFabric=new ExperienceContinuumFabric();
restoredFabric.restore(experience);
const restoredCredit=restoredFabric.summary().causalReplayCredit;
assert.equal(restoredCredit.assignments,3);
assert.equal(restoredCredit.verifiedAssignments,0,'runtime restore must strip legacy verification authority');
assert.equal(restoredCredit.meanCredit01,0);
assert.equal(restoredCredit.recentCount,3);
assert.deepEqual(experience.adaptiveReplayGovernor.laneCounts,base.adaptiveReplayGovernor.laneCounts);
console.log(JSON.stringify({pass:true,status:'P2688_MIGRATION_PASS',schemaFrom:195,schemaTo:migrated.schemaVersion,causalReplayCredit:experience.causalReplayCredit},null,2));
