import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const legacy={schemaVersion:120,facets:{learning:{p36:{version:3,cycles:9,hypotheses:[],experiments:[],developmentCycles:[],externalEvidence:[],metrics:{autonomy01:.7},curriculum:{focus:'learning',mastery:{learning:.6}}}}}};
const m=migratePersistedOrganism(legacy);
assert.equal(m.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(m.facets.learning.p36.version,4);
assert.equal(Array.isArray(m.facets.learning.p36.investmentDecisions),true);
assert.equal(m.facets.learning.p36.investmentDecisions.length,0);
console.log('BIG_PASS_112_MIGRATION=PASS',JSON.stringify({schema:m.schemaVersion,p36:m.facets.learning.p36.version,decisions:m.facets.learning.p36.investmentDecisions.length}));
