import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const marker={decisions:17,eligibleAutonomousDecisions:13,causallyInfluencedDecisions:9,agendaCreations:3,outcomes:8,successfulCausalOutcomes:7,meanKernelBias01:.081,meanInitiative01:.61,meanCounterfactualMargin01:-.052,lesion01:.25,recent:[]};
const legacy={schemaVersion:127,state:{},goals:[],traces:[],memories:[],worldModel:{},facets:{memory:{},embodiment:{},learning:{},consciousness:{},evolution:{},cognition:{},advanced:{}},system:{b306AutonomousInitiativeVerification:marker}};
const migrated=migratePersistedOrganism(legacy);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.deepEqual(migrated.system.b306AutonomousInitiativeVerification,marker,'B306 migration preservation failed');
console.log(JSON.stringify({pass:'BIG_PASS_306_MIGRATION',schema:migrated.schemaVersion,decisions:migrated.system.b306AutonomousInitiativeVerification?.decisions,causallyInfluenced:migrated.system.b306AutonomousInitiativeVerification?.causallyInfluencedDecisions,verified:true},null,2));
