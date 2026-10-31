import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const legacy={version:34.79,facets:{advanced:{experienceContinuum:{version:5,replay:{runs:2,selected:3,reactivated:1,validated:1,lastAt:10,events:[],validations:[],experiments:[],protocols:[]}}}}};
const migrated=migratePersistedOrganism(legacy);
const exp=migrated.facets.advanced.experienceContinuum;
assert.equal(exp.version,7); assert.ok(Array.isArray(exp.replay.longitudinal)); assert.equal(exp.replay.longitudinal.length,0);
console.log('BIG_PASS_106_MIGRATION=PASS',JSON.stringify({experienceVersion:exp.version,longitudinal:exp.replay.longitudinal.length}));
