import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const migrated = migratePersistedOrganism({schemaVersion:43, state:{tick:2,at:1000,needs:{},lastAction:'wait'},facets:{embodiment:{p41NativePerception:{audioFrames:4,semanticCues:[{label:'audio-activity'}]}}}});
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.facets.embodiment.p41NativePerception.audioFrames,4);
assert.equal(migrated.facets.embodiment.p41NativePerception.semanticCues.length,1);
console.log('P41_MIGRATION=PASS schema='+ORGANISM_STATE_SCHEMA);
