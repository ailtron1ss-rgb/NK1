import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const runtimePackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const integrationManifest = JSON.parse(await readFile(new URL('../../../contracts/integration-manifest.json', import.meta.url), 'utf8'));

assert.equal(RELEASE_CONTRACT.application, runtimePackage.version, 'embedded release contract must match the canonical runtime package');
assert.equal(integrationManifest.activeRuntime.version, runtimePackage.version, 'integration manifest must point to the same canonical runtime version');
assert.equal(RELEASE_CONTRACT.stateSchema, integrationManifest.activeRuntime.schema, 'embedded state schema must match the integration manifest');

const migrated = migratePersistedOrganism({ schemaVersion: 223, state: { version: 223, tick: 1 }, facets: {} });
assert.equal(migrated.schemaVersion, RELEASE_CONTRACT.stateSchema, 'legacy schema 223 must normalize into the current schema');
assert.equal(migrated.state.version, RELEASE_CONTRACT.stateSchema, 'normalized state body must use the current schema');

console.log(`RELEASE_CONTRACT_ALIGNMENT_WORKPASS36=PASS version=${RELEASE_CONTRACT.application} schema=${RELEASE_CONTRACT.stateSchema} migrated223=true`);
