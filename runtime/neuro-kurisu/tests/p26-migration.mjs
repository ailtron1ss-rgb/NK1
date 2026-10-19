import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated=migratePersistedOrganism({schemaVersion:28,state:{version:28}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.ok(migrated.facets.learning.p26);
assert.ok(migrated.facets.learning.p26.policy.weights.explore);
console.log('P26_MIGRATION=PASS schema=current');
