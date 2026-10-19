import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={schemaVersion:117,facets:{learning:{p36:{version:1,hypotheses:[],experiments:[{id:'x'}]}}}};
const out=migratePersistedOrganism(raw);
assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.ok(Array.isArray(out.facets.learning.p36.externalEvidence));
console.log('BIG_PASS_109_MIGRATION=PASS',JSON.stringify({schema:out.schemaVersion,evidence:out.facets.learning.p36.externalEvidence.length}));
