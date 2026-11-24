import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const old={schemaVersion:20,state:{version:20,tick:14},facets:{advanced:{worldModel2:{modelVersion:2}}}};
const migrated=migratePersistedOrganism(old);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.state.version,ORGANISM_STATE_SCHEMA);
assert.ok(migrated.facets.advanced.longitudinal);
assert.deepEqual(migrated.facets.advanced.longitudinal.replayedTraceIds,[]);
console.log(`P18_MIGRATION=PASS schema=${migrated.schemaVersion}`);
