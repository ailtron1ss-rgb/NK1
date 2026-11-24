import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={schemaVersion:43,state:{version:43},facets:{embodiment:{p41SemanticPerception:{tick:2},p41NativePerception:{frames:3,imageFrames:2,audioFrames:1}}}};
const out=migratePersistedOrganism(raw);
assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(out.facets.embodiment.p41SemanticPerception.tick,2);
assert.equal(out.facets.embodiment.p41NativePerception.frames,3);
console.log('P41_NATIVE_MIGRATION=PASS schema=current');
