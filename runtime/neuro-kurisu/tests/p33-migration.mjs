import { strict as assert } from 'node:assert';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const migrated=migratePersistedOrganism({schemaVersion:35,state:{tick:4}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.consciousness.p33.identity.canonicalName,'Makise Kurisu');
console.log('P33_MIGRATION=PASS', migrated.schemaVersion);
