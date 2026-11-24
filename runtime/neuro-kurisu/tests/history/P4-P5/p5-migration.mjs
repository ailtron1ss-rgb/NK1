import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const legacy={schemaVersion:6,state:{version:2,tick:4,at:Date.now(),needs:{energy:0.7,cognitiveLoad:0.2,uncertainty:0.6,socialNeed:0.2,novelty:0.5,identityCoherence:0.88,goalPressure:0.3},predictionError:0.3,attentionBudget:0.8,lastAction:'explore',lastActionSuccess:0.7,autonomyScore:0.4,selfPredictionError:0.2,predictedNextAction:'verify',lastPredictionConfidence:0.7,worldContextVersion:2},worldModel:{belief:null,transitions:[]},p1:{},p2:{},p3:{},p4:{}};
const migrated=migratePersistedOrganism(legacy);
if(migrated.schemaVersion!==7) throw new Error('schema did not migrate to 7');
if(!migrated.facets.evolution?.selfProjects || !migrated.facets.evolution?.agency || !migrated.facets.evolution?.valueEvolution || !migrated.facets.evolution?.identityTrajectory || !migrated.facets.evolution?.narrative) throw new Error('P5 state missing after migration');
console.log('P5_MIGRATION=PASS');
