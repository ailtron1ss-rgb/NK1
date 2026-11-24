import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const old={schemaVersion:19,state:{version:19},facets:{embodiment:{bodyEvents:[],perceptionRouting:{version:1}}}};
const migrated=migratePersistedOrganism(old);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.embodiment.multimodal.version,1);
assert.deepEqual(migrated.facets.embodiment.toolAudit,[]);
console.log(`P17_MIGRATION=PASS schema=${migrated.schemaVersion}`);
