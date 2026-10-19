import { strict as assert } from 'node:assert';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated=migratePersistedOrganism({schemaVersion:36,state:{tick:9}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.consciousness.p34.identityProfile.protectedIdentityAssertion,'Я — Курису Макисэ.');
console.log('P34_MIGRATION=PASS',migrated.schemaVersion);
