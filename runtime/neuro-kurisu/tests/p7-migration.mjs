import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const legacy={schemaVersion:8,state:{version:8,tick:4,needs:{energy:.7}},facets:{memory:{eventLog:[],autobiographicalMemories:[]},learning:{},consciousness:{},evolution:{}}};
const m=migratePersistedOrganism(legacy);
if(m.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('migration-schema');
if(!m.facets.memory.semanticGraph) throw new Error('semantic-graph-missing');
if(!m.facets.learning.neuromodulation) throw new Error('neuromodulation-missing');
if(!m.facets.evolution.network) throw new Error('network-missing');
console.log('P7_MIGRATION=PASS');
