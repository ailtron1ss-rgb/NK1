import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const migrated = migratePersistedOrganism({schemaVersion:12,state:{tick:5},facets:{advanced:{worldModel2:{}}}});
assert.equal(migrated.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.state.version, RELEASE_CONTRACT.stateSchema);
assert.ok(migrated.facets.advanced.selfGovernance);
assert.ok(migrated.facets.advanced.futureSelf);
assert.ok(Array.isArray(migrated.facets.advanced.consequenceAttribution));
console.log('P11_MIGRATION=PASS');
