import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const migrated=migratePersistedOrganism({schemaVersion:111,state:{version:111,tick:7},facets:{advanced:{
  experienceContinuum:{version:3,graphNodes:[{memoryId:'old-m',stability01:.6,replayPriority01:.7}],replay:{runs:2,selected:4,reactivated:1,lastAt:10}},
  causalExperience:{version:1,records:[{id:'old-cx',tick:1,traceId:'t',consolidated:false}]},
  unifiedLearning:{version:1,patterns:[],sharedRepresentation01:new Array(16).fill(.5)}
}}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
const ec=migrated.facets.advanced.experienceContinuum;
assert.equal(ec.version,6); assert.equal(ec.graphNodes[0].lastReplayedAt,0); assert.deepEqual(ec.graphNodes[0].activeGoalIds,[]); assert.deepEqual(ec.replay.events,[]);
const cx=migrated.facets.advanced.causalExperience;
assert.equal(cx.version,3); assert.equal(cx.records[0].provenance,'runtime-outcome'); assert.equal(cx.records[0].stateGrounded,true);
const ul=migrated.facets.advanced.unifiedLearning;
assert.equal(ul.version,2); assert.equal(ul.provenanceCounts.experienceReplay,0); assert.deepEqual(ul.transferProbes,[]);
console.log('BIG_PASS_103_MIGRATION=PASS',JSON.stringify({schema:migrated.schemaVersion,experienceVersion:ec.version,causalVersion:cx.version,unifiedVersion:ul.version}));
