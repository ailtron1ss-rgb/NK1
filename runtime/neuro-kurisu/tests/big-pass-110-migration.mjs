import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const out=migratePersistedOrganism({schemaVersion:118,facets:{learning:{p36:{version:1,hypotheses:[],experiments:[],externalEvidence:[]}}}});

assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(out.facets.learning.p36.version,4);
assert.ok(Array.isArray(out.facets.learning.p36.developmentCycles));
console.log('BIG_PASS_110_MIGRATION=PASS',JSON.stringify({schema:out.schemaVersion,p36Version:out.facets.learning.p36.version,cycles:out.facets.learning.p36.developmentCycles.length}));
