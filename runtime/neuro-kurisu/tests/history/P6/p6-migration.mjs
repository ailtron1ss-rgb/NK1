import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const legacy={schemaVersion:7,state:{version:2,tick:7,at:Date.now(),needs:{energy:.6,cognitiveLoad:.3,uncertainty:.4,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.2},predictionError:.2,attentionBudget:.8,lastAction:'explore',lastActionSuccess:.7,autonomyScore:.4,selfPredictionError:.1,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:3},goals:[],traces:[],memories:[],worldModel:{belief:null,transitions:[]},p1:{},p2:{},p3:{},p4:{},p5:{}};
const m=migratePersistedOrganism(legacy);
if(m.schemaVersion!==RELEASE_CONTRACT.stateSchema || m.state.version!==RELEASE_CONTRACT.stateSchema) throw new Error('schema did not normalize to 8');
if(!m.facets?.memory || !m.facets?.embodiment || !m.facets?.learning || !m.facets?.consciousness || !m.facets?.evolution) throw new Error('domain facets missing');
if(m.p1 || m.p2 || m.p3 || m.p4 || m.p5) throw new Error('legacy phase keys leaked into canonical state');
if(m.system?.organismCore!==RELEASE_CONTRACT.organismCore) throw new Error('release contract missing after migration');
console.log('P6_MIGRATION=PASS');
