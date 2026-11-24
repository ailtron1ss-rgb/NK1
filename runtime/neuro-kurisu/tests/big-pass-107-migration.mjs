import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const out=migratePersistedOrganism({schemaVersion:115,facets:{advanced:{experienceContinuum:{version:6},unifiedLearning:{version:2}}}});

assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(out.facets.advanced.cognitiveResearchBattery.version,3);
assert.ok(Array.isArray(out.facets.advanced.cognitiveResearchBattery.protocols));
console.log('BIG_PASS_107_MIGRATION=PASS',JSON.stringify({schema:out.schemaVersion,batteryVersion:out.facets.advanced.cognitiveResearchBattery.version,protocols:out.facets.advanced.cognitiveResearchBattery.protocols.length}));
