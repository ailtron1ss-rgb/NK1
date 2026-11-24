import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const legacy={schemaVersion:9,state:{version:9,tick:12,needs:{energy:.6}},facets:{memory:{eventLog:[],autobiographicalMemories:[]},learning:{},consciousness:{},evolution:{network:{tick:2,capacity:3,lastBroadcast:null,history:[],totalIgnitions:0}}}};
const m=migratePersistedOrganism(legacy);
if(m.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('migration-schema');
if(!m.facets.cognition) throw new Error('cognition-facet-missing');
if(!m.facets.cognition.cognitiveField) throw new Error('cognitive-field-missing');
if(!m.facets.cognition.budget) throw new Error('budget-missing');
if(!m.facets.cognition.immune) throw new Error('immune-missing');
if(!m.facets.cognition.skills) throw new Error('skills-missing');
if(!m.facets.cognition.scientific) throw new Error('scientific-missing');
console.log('P8_MIGRATION=PASS');
