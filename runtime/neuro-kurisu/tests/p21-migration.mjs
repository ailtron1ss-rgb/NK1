import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const old={schemaVersion:24,state:{version:24,tick:7},facets:{advanced:{temporalContinuity:{sessionCount:3}}}};
const out=migratePersistedOrganism(old);

assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(out.state.version,ORGANISM_STATE_SCHEMA);
assert.equal(out.facets.advanced.temporalContinuity.sessionCount,3);
assert.ok(out.facets.advanced.advancedResilience);
console.log(JSON.stringify({ok:true,from:24,to:43,resilience:out.facets.advanced.advancedResilience.version},null,2));
