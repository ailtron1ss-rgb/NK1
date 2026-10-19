import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated=migratePersistedOrganism({schemaVersion:42,state:{version:42},facets:{learning:{p39:{lifeTicks:4}},embodiment:{p37:{tick:2}}}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.ok(migrated.facets.learning.p40ModelEcology);
assert.ok(migrated.facets.embodiment.p40SemanticIntelligence);
console.log('P40_MIGRATION=PASS');
