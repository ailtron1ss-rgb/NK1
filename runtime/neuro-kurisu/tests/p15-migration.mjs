import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={schemaVersion:17,state:{version:17},facets:{learning:{}}};
const m=migratePersistedOrganism(raw);
assert.equal(m.schemaVersion,ORGANISM_STATE_SCHEMA); assert.equal(m.facets.learning.lifelong.version,1); assert.ok(Array.isArray(m.facets.learning.lifelong.skills));
console.log('P15_MIGRATION=PASS');
