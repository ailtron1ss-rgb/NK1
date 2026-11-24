import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated=migratePersistedOrganism({schemaVersion:21,state:{version:21,tick:4},facets:{advanced:{longitudinal:{observedCycles:4}}}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.advanced.adaptiveDevelopment.version,1);
assert.equal(migrated.facets.advanced.longitudinal.observedCycles,4);
console.log('P19_MIGRATION=PASS schema=current adaptiveDevelopment=present legacyLongitudinal=preserved');
