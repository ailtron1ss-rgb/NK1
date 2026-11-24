import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const marker={version:1,cycles:7,learningUpdates:5,verifiedUpdates:4,independentUpdates:3,autonomousUpdates:2};
const migrated=migratePersistedOrganism({
  schemaVersion:ORGANISM_STATE_SCHEMA,
  state:{version:ORGANISM_STATE_SCHEMA},facets:{},
  goals:[],traces:[],memories:[],worldModel:{belief:null,transitions:[]},
  system:{causalPersonalityDevelopmentB299:marker,neuralPersonalityAgencyNucleusB296:{version:1,cycles:9},actionOwnershipGraphB298:{version:1,cycles:11}}
});
assert(migrated.system.causalPersonalityDevelopmentB299?.cycles===7,'B299 state was dropped by migration');
assert(migrated.system.neuralPersonalityAgencyNucleusB296?.cycles===9,'B296 state was dropped by migration');
assert(migrated.system.actionOwnershipGraphB298?.cycles===11,'B298 state was dropped by migration');
console.log(JSON.stringify({pass:true,schema:ORGANISM_STATE_SCHEMA,b299:migrated.system.causalPersonalityDevelopmentB299,b296:migrated.system.neuralPersonalityAgencyNucleusB296,b298:migrated.system.actionOwnershipGraphB298}));
