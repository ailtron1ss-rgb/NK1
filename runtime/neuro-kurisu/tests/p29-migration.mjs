import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const next=migratePersistedOrganism({schemaVersion:31,state:{version:31,tick:3},facets:{learning:{p28:{observations:4}}}});

assert.equal(RELEASE_CONTRACT.stateSchema,ORGANISM_STATE_SCHEMA);
assert.equal(next.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(next.state.version,ORGANISM_STATE_SCHEMA);
assert.equal(next.facets.learning.p29.version,1);
assert.equal(next.facets.learning.p28.observations,4);
console.log('P29_MIGRATION=PASS schema=current p29=present');
