import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const migrated=migratePersistedOrganism({schemaVersion:38,state:{tick:3,needs:{energy:.8}}});
assert.equal(migrated.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.state.version,RELEASE_CONTRACT.stateSchema);
assert.ok(migrated.facets.learning.p36);
assert.equal(migrated.facets.learning.p36.version,4);
console.log('P36_MIGRATION=PASS',JSON.stringify({schema:migrated.schemaVersion,hypotheses:migrated.facets.learning.p36.hypotheses.length}));
