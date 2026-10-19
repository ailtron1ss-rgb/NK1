import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import assert from 'node:assert/strict';
const migrated=migratePersistedOrganism({schemaVersion:29,state:{version:29},facets:{}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA); assert.equal(migrated.state.version,ORGANISM_STATE_SCHEMA); assert.equal(migrated.facets.cognition.p27.version,1); assert.equal(migrated.facets.cognition.p27.latent.vector.length,16);
console.log('P27_MIGRATION=PASS schema=current p27=present');
