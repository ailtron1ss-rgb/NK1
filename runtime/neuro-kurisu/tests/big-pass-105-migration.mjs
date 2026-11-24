import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const raw={schemaVersion:113,facets:{advanced:{experienceContinuum:{version:5,replay:{experiments:[{id:'x',experimentId:'e',taskId:'t',mode:'replay-on',preScore01:.5,postScore01:.7,delta01:.2,independentVerified:true,randomized:true,contextKey:'c'}]}}}}};
const out=migratePersistedOrganism(raw);
assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(out.facets.advanced.experienceContinuum.replay.experiments.length,1);
assert.ok(Array.isArray(out.facets.advanced.experienceContinuum.replay.protocols));
console.log('BIG_PASS_105_MIGRATION=PASS',JSON.stringify({schema:out.schemaVersion,protocols:out.facets.advanced.experienceContinuum.replay.protocols.length}));
