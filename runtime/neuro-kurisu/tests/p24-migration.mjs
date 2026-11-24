import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const old={schemaVersion:26,state:{version:26,tick:1,at:1,needs:{energy:.8,cognitiveLoad:.1,uncertainty:.2,socialNeed:.2,novelty:.3,identityCoherence:.8,goalPressure:.2},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:0,selfPredictionError:0,predictedNextAction:'wait',lastPredictionConfidence:.4,worldContextVersion:1},goals:[],traces:[],memories:[],worldModel:{belief:null,transitions:[]},facets:{learning:{p23:{}},advanced:{}},system:{schemaVersion:26}};
const next=migratePersistedOrganism(old);
assert.equal(next.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(next.facets.advanced.p24.version,1);
assert.equal(next.facets.advanced.p24.behavioralGenome.active,'analyst');
console.log('P24_MIGRATION=PASS schema=current');
