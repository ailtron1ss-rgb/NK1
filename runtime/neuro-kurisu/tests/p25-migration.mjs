import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const migrated = migratePersistedOrganism({schemaVersion:27,state:{tick:4}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.state.version,ORGANISM_STATE_SCHEMA);
assert.ok(migrated.facets.advanced.p25);
assert.equal(migrated.facets.advanced.p25.version, 1);
assert.equal(migrated.facets.advanced.p25.metrics.evaluations, 0);

const legacy = migratePersistedOrganism({schemaVersion:20,p23:{learning:{}}});
assert.equal(legacy.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.ok(legacy.facets.advanced.p25);
console.log('P25_MIGRATION=PASS', migrated.schemaVersion);
