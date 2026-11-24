import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const a=migratePersistedOrganism({schemaVersion:116,facets:{advanced:{cognitiveResearchBattery:{version:2,protocols:[{id:'legacy'}],trials:[{id:'t'}],analyses:[{id:'a'}]}}}});
assert.equal(a.schemaVersion,ORGANISM_STATE_SCHEMA); assert.equal(a.facets.advanced.cognitiveResearchBattery.version,3); assert.equal(a.facets.advanced.cognitiveResearchBattery.protocols.length,1); assert.ok(Array.isArray(a.facets.advanced.cognitiveResearchBattery.sessions)); assert.ok(Array.isArray(a.facets.advanced.cognitiveResearchBattery.schedules));
const b=migratePersistedOrganism({schemaVersion:115,facets:{advanced:{cognitiveResearchBattery:{version:2}}}}); assert.equal(b.schemaVersion,ORGANISM_STATE_SCHEMA); assert.equal(b.facets.advanced.cognitiveResearchBattery.version,3);
console.log('BIG_PASS_108_MIGRATION=PASS',JSON.stringify({schema:ORGANISM_STATE_SCHEMA,batteryVersion:a.facets.advanced.cognitiveResearchBattery.version,legacyProtocols:a.facets.advanced.cognitiveResearchBattery.protocols.length}));
