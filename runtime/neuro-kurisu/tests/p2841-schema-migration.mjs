import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const migrated=migratePersistedOrganism({schemaVersion:210});
assert.equal(ORGANISM_STATE_SCHEMA,RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.system.release,RELEASE_CONTRACT.application);
assert.equal(migrated.system.organismCore,RELEASE_CONTRACT.organismCore);
assert.equal(migrated.state.version,RELEASE_CONTRACT.stateSchema);
console.log(JSON.stringify({ok:true,sourceSchema:210,targetSchema:migrated.schemaVersion,release:migrated.system.release,core:migrated.system.organismCore}));
