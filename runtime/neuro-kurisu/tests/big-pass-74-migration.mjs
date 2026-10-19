import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const migrated = migratePersistedOrganism({
  schemaVersion: 104,
  state: { version: 104 },
  facets: { advanced: {} }
});
assert.equal(RELEASE_CONTRACT.stateSchema, 111);
assert.equal(RELEASE_CONTRACT.application, '34.61.0');
assert.equal(migrated.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.ok(migrated.facets?.advanced?.experienceContinuum);
assert.equal(migrated.facets.advanced.experienceContinuum.version, 2);
assert.ok(migrated.facets?.evolution?.developmentalAttractors);
assert.equal(migrated.facets.evolution.developmentalAttractors.attractors.length,8);
console.log(JSON.stringify({ok:true,schema:migrated.schemaVersion,hasExperienceContinuum:true}));
