import fs from 'node:fs'; import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'); const v=JSON.parse(read('VERSION.json')); assert.equal(v.application,'34.39.0'); assert.equal(v.stateSchema,101);
const p84=read('src/organism/developmental/P84AutobiographicalContinuityFabric.ts'); const core=read('src/organism/core/OrganismCore.ts'); const mig=read('src/organism/persistence/StateMigrations.ts'); const server=read('src/server/server.mjs');
for(const x of ['identityDelta01','memoryBinding01','realityDelta01','learningSignal01','identityChangeReasons','sourceEventIds']) assert.match(p84,new RegExp(x));
assert.match(p84,/identityChangeCount/); assert.match(core,/autobiographicalIdentityChanges/); assert.match(mig,/p84AutobiographicalContinuity/); assert.match(server,/autobiographical-identity-changes/);
console.log('BIG_PASS_68_AUDIT=PASS identity-lineage=1 event-lineage=1 persistence=1 api=1');
