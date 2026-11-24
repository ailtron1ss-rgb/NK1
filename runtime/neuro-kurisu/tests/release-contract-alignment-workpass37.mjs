import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const runtimePackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const integrationManifest = JSON.parse(await readFile(new URL('../../../contracts/integration-manifest.json', import.meta.url), 'utf8'));
const runtimeVersion = JSON.parse(await readFile(new URL('../VERSION.json', import.meta.url), 'utf8'));
const releaseManifest = JSON.parse(await readFile(new URL('../RELEASE_MANIFEST.json', import.meta.url), 'utf8'));
const runtimeLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const superVersion = JSON.parse(await readFile(new URL('../../../SUPER_VERSION.json', import.meta.url), 'utf8'));

assert.equal(RELEASE_CONTRACT.application, runtimePackage.version);
assert.equal(RELEASE_CONTRACT.application, runtimeVersion.application);
assert.equal(RELEASE_CONTRACT.application, releaseManifest.version);
assert.equal(RELEASE_CONTRACT.application, runtimeLock.packages[''].version);
assert.equal(RELEASE_CONTRACT.phase, runtimeVersion.phase);
assert.equal(RELEASE_CONTRACT.phase, releaseManifest.phase);
assert.equal(integrationManifest.activeRuntime.version, runtimePackage.version);
assert.equal(superVersion.canonicalRuntime, `Neuro-Kurisu ${runtimePackage.version}`);
assert.equal(RELEASE_CONTRACT.stateSchema, integrationManifest.activeRuntime.schema);
assert.equal(superVersion.schema, RELEASE_CONTRACT.stateSchema);
assert.equal(RELEASE_CONTRACT.stateSchema, 225, 'durable action receipt ledger belongs to schema 225');

const previousSchema = migratePersistedOrganism({
  schemaVersion: 224,
  state: { version: 224, tick: 4 },
  facets: {},
  system: {},
});
assert.equal(previousSchema.schemaVersion, 225);
assert.equal(previousSchema.state.version, 225);
assert.deepEqual(previousSchema.system.actionExecutionLedger, { version: 1, records: [] });

const sampleReceipt = {
  keyHash: 'a'.repeat(64), requestHash: 'b'.repeat(64), status: 'pending', recordedAt: 12345,
};
const migratedWithLedger = migratePersistedOrganism({
  schemaVersion: 224,
  state: { version: 224, tick: 9 },
  facets: {},
  system: { actionExecutionLedger: { version: 1, records: [sampleReceipt] } },
});
assert.deepEqual(migratedWithLedger.system.actionExecutionLedger.records, [sampleReceipt]);
assert.equal(migratedWithLedger.system.schemaVersion, 225);

// Schema 223 remains supported from the prior migration contract.
const oldestSupported = migratePersistedOrganism({ schemaVersion: 223, state: { version: 223, tick: 1 }, facets: {} });
assert.equal(oldestSupported.schemaVersion, 225);
assert.deepEqual(oldestSupported.system.actionExecutionLedger, { version: 1, records: [] });

console.log(`RELEASE_CONTRACT_ALIGNMENT_WORKPASS37=PASS version=${RELEASE_CONTRACT.application} schema=${RELEASE_CONTRACT.stateSchema} migrated223=true migrated224=true ledgerDefault=true ledgerPreserved=true`);
