import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const legacy={schemaVersion:34,state:{version:34,tick:4},facets:{consciousness:{p31:{version:2}}}};
const next=migratePersistedOrganism(legacy);
assert.equal(next.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(next.state.version,ORGANISM_STATE_SCHEMA);
assert.equal(next.facets.consciousness.p32.version,1);
assert.ok(next.facets.consciousness.p32.metrics);
console.log('P32_MIGRATION=PASS');
