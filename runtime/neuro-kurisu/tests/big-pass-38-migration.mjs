import assert from 'node:assert/strict';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={schemaVersion:83,state:{version:83,tick:3,at:1,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.3,identityCoherence:.9,goalPressure:.2},predictionError:.1,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.1,predictedNextAction:'wait',lastPredictionConfidence:.5,worldContextVersion:1},goals:[],traces:[],memories:[],facets:{},system:{schemaVersion:83}};
const out=migratePersistedOrganism(raw);
assert.equal(out.schemaVersion,RELEASE_CONTRACT.stateSchema); assert.equal(out.system.schemaVersion,RELEASE_CONTRACT.stateSchema); assert.equal(out.system.release,RELEASE_CONTRACT.application);
assert.equal(out.system.predictionDebt,undefined); // absent legacy fields remain optional and runtime defaults them on restore
console.log('BIG_PASS_38_MIGRATION=PASS',{schema:out.schemaVersion,release:out.system.release});
