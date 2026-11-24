import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const legacy={schemaVersion:37,state:{version:37,tick:2,at:100,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.2,socialNeed:.2,novelty:.3,identityCoherence:.9,goalPressure:.1},predictionError:.1,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.2,selfPredictionError:0,predictedNextAction:'wait',lastPredictionConfidence:.5,worldContextVersion:1},facets:{}};
const current=migratePersistedOrganism(legacy);
assert.equal(current.schemaVersion,ORGANISM_STATE_SCHEMA);

assert.ok(current.facets.embodiment.p35);
assert.equal(current.facets.embodiment.p35.version,1);
console.log('P35_MIGRATION=PASS',JSON.stringify({schema:current.schemaVersion,entities:current.facets.embodiment.p35.entities.length}));
