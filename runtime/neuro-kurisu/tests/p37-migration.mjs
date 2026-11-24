import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const migrated = migratePersistedOrganism({schemaVersion:39,state:{tick:4,needs:{energy:.7}},facets:{embodiment:{p35:{}}}});
assert.equal(migrated.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.ok(migrated.facets.embodiment.p37);
assert.equal(migrated.facets.embodiment.p37.version,1);
console.log(`P37_MIGRATION=PASS schema=${migrated.schemaVersion}`);
