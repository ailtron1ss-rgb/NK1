import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const raw={schemaVersion:127,system:{neuralLifeConsolidationB285:{steps:42,negativeScar01:.62,negativeScarConfidence01:.81,negativeScarCount:7,recovery01:.23,recoveryCount:3,lastScarTick:77,scarActionBiases:{respond:-.08,explore:.01,verify:0,rest:0,reflect:0,wait:0,defer:0},scarHistory:[{tick:77,action:'respond',severity01:.81,evidence01:.92,recovered01:.12}]}}};
const migrated=migratePersistedOrganism(raw);
const b=migrated.system.neuralLifeConsolidationB285;
assert.equal(migrated.schemaVersion,127);
assert.equal(ORGANISM_STATE_SCHEMA,127);
assert.equal(b.steps,42);
assert.equal(b.negativeScarCount,7);
assert.equal(b.recoveryCount,3);
assert.equal(b.lastScarTick,77);
assert.ok(Math.abs(b.negativeScar01-.62)<1e-9);
assert.equal(b.scarActionBiases.respond,-.08);
assert.equal(b.scarHistory.length,1);
console.log(JSON.stringify({pass:true,schemaVersion:migrated.schemaVersion,scar:b.negativeScar01,negativeScarCount:b.negativeScarCount,recoveryCount:b.recoveryCount,respondBias:b.scarActionBiases.respond,history:b.scarHistory.length},null,2));
process.exit(0);
