import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const raw={schemaVersion:106,state:{version:106},facets:{}};
const out=migratePersistedOrganism(raw);

assert.equal(RELEASE_CONTRACT.stateSchema,ORGANISM_STATE_SCHEMA);
assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.ok(out.facets.cognition.immune.reviewQueue);
assert.ok(out.facets.evolution.developmentalAttractors);
assert.equal(out.facets.evolution.developmentalAttractors.attractors.length,8);
console.log('PASS subject continuity schema 106 -> 110');
