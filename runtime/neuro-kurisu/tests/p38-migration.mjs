import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const s=migratePersistedOrganism({schemaVersion:40,state:{},facets:{}});
assert.equal(s.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.ok(s.facets.learning.p38);
console.log(`P38_MIGRATION=PASS schema=${s.schemaVersion}`);
