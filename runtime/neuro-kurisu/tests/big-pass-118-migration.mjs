import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const migrated=migratePersistedOrganism({state:{tick:1},facets:{advanced:{causalDevelopmentLoop:{version:1,samples:[]}}}});
const cdl=migrated.facets.advanced.causalDevelopmentLoop;
assert.equal(cdl.version,2);
assert.ok(Array.isArray(cdl.behavioralSequences));
assert.ok(Array.isArray(cdl.behavioralEpisodes));
assert.equal(cdl.behavioralSequences.length,0);
console.log(`BIG_PASS_118_MIGRATION=PASS schema=${migrated.schemaVersion} cdlVersion=${cdl.version}`);
