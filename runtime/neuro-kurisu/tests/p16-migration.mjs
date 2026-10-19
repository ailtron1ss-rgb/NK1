import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated=migratePersistedOrganism({schemaVersion:18,state:{version:18,tick:7,needs:{energy:.7}},facets:{learning:{lifelong:{cycleCount:7}}}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.state.version,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.learning.lifelong.cycleCount,7);
assert.ok(migrated.facets.learning.adaptivePolicy);
assert.equal(migrated.facets.learning.adaptivePolicy.version,1);
console.log(`P16_MIGRATION=PASS schema=${migrated.schemaVersion}`);
